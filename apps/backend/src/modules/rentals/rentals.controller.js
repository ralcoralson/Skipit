const { supabaseAdmin } = require('../../config/supabase');
const { notifyUser } = require('../notifications/fcm.service');

/**
 * 1. Create a Rental Request (Renter -> Owner)
 * Direct Peer-to-Peer Rental Request (0% platform commission)
 */
const createRentalRequest = async (req, res, next) => {
  try {
    const renterId = req.user.id;
    const { listing_id, start_date, end_date, notes } = req.body;

    if (!listing_id || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'listing_id, start_date, and end_date are required.',
      });
    }

    const start = new Date(start_date);
    const end = new Date(end_date);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid start_date or end_date format.',
      });
    }

    if (end < start) {
      return res.status(400).json({
        success: false,
        error: 'end_date must be equal to or after start_date.',
      });
    }

    // Fetch listing details to verify availability & pricing
    const { data: listing, error: listingErr } = await supabaseAdmin
      .from('listings')
      .select('id, owner_id, title, price_per_day, deposit_amount, is_active, is_available')
      .eq('id', listing_id)
      .single();

    if (listingErr || !listing) {
      return res.status(404).json({
        success: false,
        error: 'Listing not found or no longer available.',
      });
    }

    if (listing.owner_id === renterId) {
      return res.status(400).json({
        success: false,
        error: 'You cannot request to rent your own listing.',
      });
    }

    if (!listing.is_active || !listing.is_available) {
      return res.status(400).json({
        success: false,
        error: 'This listing is currently unavailable for rent.',
      });
    }

    // Calculate duration in days (minimum 1 day)
    const diffTime = Math.abs(end - start);
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const dailyRate = parseFloat(listing.price_per_day) || 0;
    const totalAmount = dailyRate * diffDays;
    const securityDeposit = parseFloat(listing.deposit_amount) || 0;

    const requestPayload = {
      listing_id,
      owner_id: listing.owner_id,
      renter_id: renterId,
      start_date: start.toISOString().split('T')[0],
      end_date: end.toISOString().split('T')[0],
      rental_duration: diffDays,
      daily_rate: dailyRate,
      total_rental_amount: totalAmount,
      security_deposit: securityDeposit,
      request_status: 'pending',
      handover_notes: notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: rentalRequest, error: insertErr } = await supabaseAdmin
      .from('rental_requests')
      .insert([requestPayload])
      .select()
      .single();

    if (insertErr) {
      return res.status(400).json({
        success: false,
        error: insertErr.message,
      });
    }

    // Also link or initiate a conversation & message between renter and owner
    try {
      const inquiryMsg = `📅 Rental Request submitted for "${listing.title}"\n• Duration: ${diffDays} day(s) (${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]})\n• Estimated Total: ₹${totalAmount}${securityDeposit > 0 ? ` + ₹${securityDeposit} Deposit` : ''}\n• Direct P2P Payment on pickup\n${notes ? `• Note: "${notes}"` : ''}`;

      await supabaseAdmin.from('messages').insert([{
        sender_id: renterId,
        receiver_id: listing.owner_id,
        content: inquiryMsg,
        booking_id: listing.id,
        rental_request_id: rentalRequest.id,
        is_read: false,
        created_at: new Date().toISOString(),
      }]);
    } catch (msgErr) {
      console.warn('[Rental Request Chat Warning]:', msgErr.message);
    }

    // Notify owner of incoming rental request
    notifyUser(listing.owner_id, {
      title: 'New Rental Request Received! 📦',
      body: `${req.user.full_name || 'A user'} requested to rent "${listing.title}" for ${diffDays} day(s).`,
      data: {
        type: 'rental_request',
        rental_request_id: rentalRequest.id,
        listing_id,
      },
    }).catch(err => console.warn('[FCM Notify Error]:', err.message));

    res.status(201).json({
      success: true,
      message: 'Rental request sent directly to owner.',
      rental_request: rentalRequest,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Get Renter's Outgoing Requests
 */
const getMyRequests = async (req, res, next) => {
  try {
    const renterId = req.user.id;
    const { status } = req.query;

    let query = supabaseAdmin
      .from('rental_requests')
      .select(`
        *,
        listing:listings(id, title, price_per_day, deposit_amount, images, location_name),
        owner:profiles!rental_requests_owner_id_fkey(id, full_name, avatar_url, phone_number, rating, is_verified)
      `)
      .eq('renter_id', renterId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('request_status', status);
    }

    const { data: requests, error } = await query;

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      count: requests?.length || 0,
      requests: requests || [],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Get Owner's Incoming Rental Requests
 */
const getIncomingRequests = async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const { status } = req.query;

    let query = supabaseAdmin
      .from('rental_requests')
      .select(`
        *,
        listing:listings(id, title, price_per_day, deposit_amount, images, location_name),
        renter:profiles!rental_requests_renter_id_fkey(id, full_name, avatar_url, phone_number, rating, is_verified, trust_score)
      `)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('request_status', status);
    }

    const { data: requests, error } = await query;

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      count: requests?.length || 0,
      requests: requests || [],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Get Rental Request Details
 */
const getRentalRequestById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const safeProfileColumns = 'id, full_name, avatar_url, bio, location, rating, trust_score, is_verified, total_rentals, total_listings, total_reviews, phone, phone_number, created_at';

    const { data: rentalRequest, error } = await supabaseAdmin
      .from('rental_requests')
      .select(`
        *,
        listing:listings(*),
        owner:profiles!rental_requests_owner_id_fkey(${safeProfileColumns}),
        renter:profiles!rental_requests_renter_id_fkey(${safeProfileColumns})
      `)
      .eq('id', id)
      .single();

    if (error || !rentalRequest) {
      return res.status(404).json({ success: false, error: 'Rental request not found.' });
    }

    if (rentalRequest.owner_id !== userId && rentalRequest.renter_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Unauthorized to view this rental request.' });
    }

    // Phone numbers only revealed once request is accepted (Phase 1.5b)
    const isAccepted = rentalRequest.request_status === 'accepted';
    if (!isAccepted) {
      if (rentalRequest.owner) {
        delete rentalRequest.owner.phone;
        delete rentalRequest.owner.phone_number;
      }
      if (rentalRequest.renter) {
        delete rentalRequest.renter.phone;
        delete rentalRequest.renter.phone_number;
      }
    }

    res.json({
      success: true,
      rental_request: rentalRequest,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Owner Respond to Request (Accept / Reject)
 */
const respondRentalRequest = async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const { id } = req.params;
    const { status, owner_response } = req.body;

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status must be either "accepted" or "rejected".',
      });
    }

    // Check ownership of request
    const { data: request, error: findErr } = await supabaseAdmin
      .from('rental_requests')
      .select('*, listing:listings(title)')
      .eq('id', id)
      .single();

    if (findErr || !request) {
      return res.status(404).json({ success: false, error: 'Rental request not found.' });
    }

    if (request.owner_id !== ownerId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only the listing owner can respond to this request.' });
    }

    if (request.request_status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Rental request is already ${request.request_status}.`,
      });
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('rental_requests')
      .update({
        request_status: status,
        owner_response: owner_response || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      return res.status(400).json({ success: false, error: updateErr.message });
    }

    // Send confirmation message in chat thread
    const statusMsg = status === 'accepted'
      ? `🎉 Rental Request ACCEPTED! Please coordinate direct pickup/handover and direct peer-to-peer payment.\n${owner_response ? `Owner Note: "${owner_response}"` : ''}`
      : `❌ Rental Request declined by owner.\n${owner_response ? `Reason: "${owner_response}"` : ''}`;

    await supabaseAdmin.from('messages').insert([{
      sender_id: ownerId,
      receiver_id: request.renter_id,
      content: statusMsg,
      booking_id: request.listing_id,
      rental_request_id: request.id,
      is_read: false,
      created_at: new Date().toISOString(),
    }]).catch(err => console.warn('[Chat Response Msg Error]:', err.message));

    // Notify Renter
    notifyUser(request.renter_id, {
      title: status === 'accepted' ? 'Rental Request Accepted! 🎉' : 'Rental Request Declined',
      body: `Your request for "${request.listing?.title || 'item'}" was ${status}.`,
      data: {
        type: 'rental_status_update',
        rental_request_id: id,
        status,
      },
    }).catch(err => console.warn('[FCM Notify Error]:', err.message));

    res.json({
      success: true,
      message: `Rental request ${status}.`,
      rental_request: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Cancel Rental Request (Renter or Owner)
 */
const cancelRentalRequest = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { data: request, error: findErr } = await supabaseAdmin
      .from('rental_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (findErr || !request) {
      return res.status(404).json({ success: false, error: 'Rental request not found.' });
    }

    if (request.renter_id !== userId && request.owner_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Unauthorized to cancel this request.' });
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('rental_requests')
      .update({
        request_status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      return res.status(400).json({ success: false, error: updateErr.message });
    }

    res.json({
      success: true,
      message: 'Rental request cancelled successfully.',
      rental_request: updated,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRentalRequest,
  getMyRequests,
  getIncomingRequests,
  getRentalRequestById,
  respondRentalRequest,
  cancelRentalRequest,
};
