const { supabaseAdmin } = require('../../config/supabase');
const { uploadToSupabaseStorage } = require('../../middleware/upload');
const { notifyUser } = require('../notifications/fcm.service');
const { validateUUID } = require('../../utils/filterSanitizer');

// Helper to generate 15-minute signed URL for private chat attachments (Phase 1.10)
const createChatSignedUrl = async (pathOrUrl) => {
  if (!pathOrUrl) return null;
  const objectPath = pathOrUrl.includes('/chat-attachments/')
    ? pathOrUrl.split('/chat-attachments/')[1].split('?')[0]
    : pathOrUrl;
  try {
    const { data } = await supabaseAdmin.storage
      .from('chat-attachments')
      .createSignedUrl(objectPath, 900);
    return data?.signedUrl || null;
  } catch (e) {
    return null;
  }
};

// 1. Get Conversation List for Current User
const getConversations = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;

    // Fetch all messages where current user is sender or receiver
    const { data: messages, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    // Group messages by peer user ID
    const peerMap = new Map();

    for (const msg of messages || []) {
      const peerId = msg.sender_id === currentUserId ? msg.receiver_id : msg.sender_id;
      if (!peerMap.has(peerId)) {
        peerMap.set(peerId, {
          peer_id: peerId,
          last_message: msg,
          unread_count: 0,
          booking_id: msg.booking_id,
        });
      }

      if (msg.receiver_id === currentUserId && !msg.is_read) {
        peerMap.get(peerId).unread_count += 1;
      }
    }

    const conversations = [];

    // Hydrate peer profiles and optional listing previews
    for (const [peerId, conv] of peerMap.entries()) {
      const { data: peerProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, avatar_url, is_verified, rating, trust_score')
        .eq('id', peerId)
        .maybeSingle();

      // Check if conversation relates to a listing (stored in booking_id or metadata)
      let listing = null;
      if (conv.booking_id) {
        const { data: listingData } = await supabaseAdmin
          .from('listings')
          .select('id, title, price_per_day, images, category, location_name')
          .eq('id', conv.booking_id)
          .maybeSingle();
        listing = listingData;
      }

      conversations.push({
        id: `conv_${[currentUserId, peerId].sort().join('_')}`,
        peer: peerProfile || { id: peerId, full_name: 'SkipIt User' },
        last_message: conv.last_message,
        unread_count: conv.unread_count,
        listing: listing,
        updated_at: conv.last_message ? conv.last_message.created_at : new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      conversations,
    });
  } catch (error) {
    next(error);
  }
};

// 2. Get Messages Between Current User and Peer
const getMessages = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const cleanPeerId = validateUUID(req.params.peerId, 'peerId');
    const { page = 1, limit = 50 } = req.query;

    const from = (parseInt(page) - 1) * parseInt(limit);
    const to = from + parseInt(limit) - 1;

    const { data: rawMessages, count, error } = await supabaseAdmin
      .from('messages')
      .select('*', { count: 'exact' })
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${cleanPeerId}),and(sender_id.eq.${cleanPeerId},receiver_id.eq.${currentUserId})`)
      .order('created_at', { ascending: true })
      .range(from, to);

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    // Auto mark received messages as read
    supabaseAdmin
      .from('messages')
      .update({ is_read: true })
      .eq('sender_id', cleanPeerId)
      .eq('receiver_id', currentUserId)
      .eq('is_read', false)
      .then();

    // Hydrate signed URLs for attachments from private chat-attachments bucket
    const messages = await Promise.all((rawMessages || []).map(async (msg) => {
      if (msg.attachment_url) {
        const signedUrl = await createChatSignedUrl(msg.attachment_url);
        return {
          ...msg,
          attachment_signed_url: signedUrl,
          attachment_url: signedUrl || msg.attachment_url,
        };
      }
      return msg;
    }));

    // Fetch peer profile
    const { data: peerProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, avatar_url, is_verified, rating, trust_score, location')
      .eq('id', cleanPeerId)
      .maybeSingle();

    res.json({
      success: true,
      messages: messages || [],
      peer: peerProfile,
      total: count || 0,
    });
  } catch (error) {
    next(error);
  }
};

// 3. Send Message (Phase 1.10: receiver verification, block checks, 2000 char cap, private bucket)
const sendMessage = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const { receiver_id, content, listing_id, rental_request_id } = req.body;

    if (!receiver_id) {
      return res.status(400).json({ success: false, error: 'Recipient ID is required' });
    }

    const cleanReceiverId = validateUUID(receiver_id, 'receiver_id');

    if (cleanReceiverId === currentUserId) {
      return res.status(400).json({ success: false, error: 'You cannot send a message to yourself' });
    }

    // 1. Verify recipient user exists
    const { data: receiverProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .eq('id', cleanReceiverId)
      .maybeSingle();

    if (!receiverProfile) {
      return res.status(404).json({ success: false, error: 'Recipient user account does not exist' });
    }

    // 2. Check user_blocks table (neither party has blocked the other)
    const { data: block } = await supabaseAdmin
      .from('user_blocks')
      .select('id')
      .or(`and(blocker_id.eq.${currentUserId},blocked_id.eq.${cleanReceiverId}),and(blocker_id.eq.${cleanReceiverId},blocked_id.eq.${currentUserId})`)
      .maybeSingle();

    if (block) {
      return res.status(403).json({ success: false, error: 'Communication with this user is blocked' });
    }

    let finalContent = (content || '').trim();

    // 3. Cap content length at 2000 characters
    if (finalContent.length > 2000) {
      return res.status(400).json({
        success: false,
        error: 'Message content cannot exceed 2000 characters',
      });
    }

    let messageType = 'text';
    let attachmentUrl = null;

    // 4. Handle image upload to private chat-attachments bucket (NOT embedding public URLs in text)
    if (req.file) {
      attachmentUrl = await uploadToSupabaseStorage(req.file, 'chat-attachments', currentUserId);
      messageType = 'image';
      if (!finalContent) {
        finalContent = 'Shared an image';
      }
    }

    if (!finalContent && !attachmentUrl) {
      return res.status(400).json({ success: false, error: 'Message content or image attachment is required' });
    }

    const messagePayload = {
      sender_id: currentUserId,
      receiver_id: cleanReceiverId,
      content: finalContent,
      message_type: messageType,
      attachment_url: attachmentUrl,
      booking_id: listing_id || null,
      rental_request_id: rental_request_id || null,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    const { data: message, error } = await supabaseAdmin
      .from('messages')
      .insert([messagePayload])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    // Create in-app & push notification for receiver
    notifyUser(cleanReceiverId, {
      title: `New message from ${req.user.full_name || 'SkipIt User'}`,
      body: finalContent.length > 60 ? `${finalContent.substring(0, 60)}...` : finalContent,
      data: { sender_id: currentUserId, listing_id, type: 'message' },
    }).catch((err) => console.warn('[Message Notification Error]:', err.message));

    // Sign attachment URL if present for immediate client display
    if (message.attachment_url) {
      message.attachment_signed_url = await createChatSignedUrl(message.attachment_url);
    }

    res.status(201).json({
      success: true,
      message,
    });
  } catch (error) {
    next(error);
  }
};

// 4. Start Rental Inquiry from Listing Details
const startListingInquiry = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const { listing_id, initial_message } = req.body;

    if (!listing_id) {
      return res.status(400).json({ success: false, error: 'listing_id is required' });
    }

    const cleanListingId = validateUUID(listing_id, 'listing_id');

    // Fetch listing details to know the owner
    const { data: listing, error: listingErr } = await supabaseAdmin
      .from('listings')
      .select('id, owner_id, title, price_per_day, images, location_name')
      .eq('id', cleanListingId)
      .single();

    if (listingErr || !listing) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }

    if (listing.owner_id === currentUserId) {
      return res.status(400).json({ success: false, error: 'You cannot send a rental inquiry to your own listing' });
    }

    // Check user blocks
    const { data: block } = await supabaseAdmin
      .from('user_blocks')
      .select('id')
      .or(`and(blocker_id.eq.${currentUserId},blocked_id.eq.${listing.owner_id}),and(blocker_id.eq.${listing.owner_id},blocked_id.eq.${currentUserId})`)
      .maybeSingle();

    if (block) {
      return res.status(403).json({ success: false, error: 'Cannot send inquiry: User communication is blocked' });
    }

    const defaultInquiry = `Hi! I'm interested in renting your "${listing.title}" for ₹${listing.price_per_day}/day. Is it currently available for rental?`;
    let inquiryContent = (initial_message || defaultInquiry).trim();
    if (inquiryContent.length > 2000) {
      inquiryContent = inquiryContent.slice(0, 2000);
    }
    const inquiryText = initial_message || defaultInquiry;

    // Insert the inquiry message
    const { data: msg, error: msgErr } = await supabaseAdmin
      .from('messages')
      .insert([{
        sender_id: currentUserId,
        receiver_id: listing.owner_id,
        content: `[RENTAL INQUIRY for "${listing.title}"]\n${inquiryText}`,
        booking_id: null,
        is_read: false,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (msgErr) {
      return res.status(400).json({ success: false, error: msgErr.message });
    }

    // Send notification to owner
    notifyUser(listing.owner_id, {
      title: `Rental Inquiry: ${listing.title}`,
      body: `${req.user.full_name || 'A renter'} asked about your listing: "${inquiryText.substring(0, 50)}..."`,
      data: { listing_id: listing.id, sender_id: currentUserId, type: 'inquiry' },
    }).catch((err) => console.warn('[Inquiry Notification Error]:', err.message));

    res.status(201).json({
      success: true,
      message: 'Rental inquiry sent to owner',
      chat: {
        peer_id: listing.owner_id,
        listing_id: listing.id,
        initial_message: msg,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 5. Mark Messages as Read
const markAsRead = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const { peerId } = req.params;

    const { error } = await supabaseAdmin
      .from('messages')
      .update({ is_read: true })
      .eq('sender_id', peerId)
      .eq('receiver_id', currentUserId)
      .eq('is_read', false);

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.json({ success: true, message: 'Messages marked as read' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getConversations,
  getMessages,
  sendMessage,
  startListingInquiry,
  markAsRead,
};
