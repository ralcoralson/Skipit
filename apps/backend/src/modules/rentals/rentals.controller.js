const { supabaseAdmin } = require('../../config/supabase');
const { notifyUser } = require('../notifications/fcm.service');
const { validateUUID } = require('../../utils/filterSanitizer');

/**
 * Tiered Rental Pricing Calculator (Phase 3.1)
 * Rule: Full months (30-day blocks) at monthly rate,
 *       Full weeks (7-day blocks) at weekly rate,
 *       Remaining days at daily rate.
 *       Otherwise price_per_day * totalDays.
 */
function calculateRentalPrice(listing, totalDays) {
  let remainingDays = totalDays;
  let months = 0;
  let weeks = 0;
  let days = 0;
  let totalPrice = 0;

  const monthlyRate = parseFloat(listing.price_per_month);
  const weeklyRate = parseFloat(listing.price_per_week);
  const dailyRate = parseFloat(listing.price_per_day) || 0;

  if (monthlyRate && monthlyRate > 0 && remainingDays >= 30) {
    months = Math.floor(remainingDays / 30);
    totalPrice += months * monthlyRate;
    remainingDays %= 30;
  }

  if (weeklyRate && weeklyRate > 0 && remainingDays >= 7) {
    weeks = Math.floor(remainingDays / 7);
    totalPrice += weeks * weeklyRate;
    remainingDays %= 7;
  }

  days = remainingDays;
  totalPrice += days * dailyRate;

  return {
    total_price: totalPrice,
    breakdown: {
      months,
      monthly_rate: monthlyRate || 0,
      weeks,
      weekly_rate: weeklyRate || 0,
      days,
      daily_rate: dailyRate,
      total_days: totalDays,
    },
  };
}

/**
 * 1. Create a Rental Request (Renter -> Owner)
 * Phase 3.1: Enforce min/max days, overlap checks, tiered pricing, and block check
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

    const cleanListingId = validateUUID(listing_id, 'listing_id');
    const start = new Date(start_date);
    const end = new Date(end_date);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid start_date or end_date format.' });
    }

    if (end < start) {
      return res.status(400).json({ success: false, error: 'end_date must be equal to or after start_date.' });
    }

    const startDateStr = start.toISOString().split('T')[0];
    const endDateStr = end.toISOString().split('T')[0];

    // Fetch listing details to verify availability & rules
    const { data: listing, error: listingErr } = await supabaseAdmin
      .from('listings')
      .select('*')
      .eq('id', cleanListingId)
      .single();

    if (listingErr || !listing) {
      return res.status(404).json({ success: false, error: 'Listing not found or no longer available.' });
    }

    if (listing.owner_id === renterId) {
      return res.status(400).json({ success: false, error: 'You cannot request to rent your own listing.' });
    }

    if (!listing.is_active || !listing.is_available) {
      return res.status(400).json({ success: false, error: 'This listing is currently unavailable for rent.' });
    }

    // Check user_blocks
    const { data: block } = await supabaseAdmin
      .from('user_blocks')
      .select('id')
      .or(`and(blocker_id.eq.${renterId},blocked_id.eq.${listing.owner_id}),and(blocker_id.eq.${listing.owner_id},blocked_id.eq.${renterId})`)
      .maybeSingle();

    if (block) {
      return res.status(403).json({ success: false, error: 'Cannot rent item: User communication is blocked.' });
    }

    // Calculate duration in days (minimum 1 day)
    const diffTime = Math.abs(end - start);
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    // Enforce listing min_rental_days and max_rental_days
    if (listing.min_rental_days && diffDays < listing.min_rental_days) {
      return res.status(400).json({
        success: false,
        error: `Minimum rental duration for this item is ${listing.min_rental_days} day(s). Requested: ${diffDays} day(s).`,
      });
    }

    if (listing.max_rental_days && diffDays > listing.max_rental_days) {
      return res.status(400).json({
        success: false,
        error: `Maximum rental duration for this item is ${listing.max_rental_days} day(s). Requested: ${diffDays} day(s).`,
      });
    }

    // Reject overlap with an already-accepted request for this listing
    const { data: overlappingAccepted } = await supabaseAdmin
      .from('rental_requests')
      .select('id, start_date, end_date')
      .eq('listing_id', cleanListingId)
      .eq('request_status', 'accepted')
      .lte('start_date', endDateStr)
      .gte('end_date', startDateStr)
      .maybeSingle();

    if (overlappingAccepted) {
      return res.status(409).json({
        success: false,
        error: 'This listing is already booked for overlapping dates by another renter.',
      });
    }

    // Reject duplicate pending request from same renter for overlapping dates
    const { data: duplicatePending } = await supabaseAdmin
      .from('rental_requests')
      .select('id')
      .eq('listing_id', cleanListingId)
      .eq('renter_id', renterId)
      .eq('request_status', 'pending')
      .lte('start_date', endDateStr)
      .gte('end_date', startDateStr)
      .maybeSingle();

    if (duplicatePending) {
      return res.status(409).json({
        success: false,
        error: 'You already have an active pending request for this item on overlapping dates.',
      });
    }

    // Tiered pricing calculation
    const pricing = calculateRentalPrice(listing, diffDays);
    const securityDeposit = parseFloat(listing.deposit_amount) || 0;

    const requestPayload = {
      listing_id: cleanListingId,
      owner_id: listing.owner_id,
      renter_id: renterId,
      start_date: startDateStr,
      end_date: endDateStr,
      total_days: diffDays,
      total_price: pricing.total_price,
      deposit_amount: securityDeposit,
      price_breakdown: pricing.breakdown,
      rental_duration: diffDays,
      daily_rate: parseFloat(listing.price_per_day) || 0,
      total_rental_amount: pricing.total_price,
      security_deposit: securityDeposit,
      request_status: 'pending',
      renter_notes: notes || null,
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
      if (insertErr.code === '23P01' || insertErr.message?.includes('23P01') || insertErr.message?.includes('exclusion')) {
        return res.status(409).json({
          success: false,
          error: 'This listing is already booked for the selected date range.',
        });
      }
      return res.status(400).json({ success: false, error: insertErr.message });
    }

    // Create chat message linking to rental_request_id (log errors explicitly per 3.1)
    const inquiryMsg = `📅 Rental Request submitted for "${listing.title}"\n• Duration: ${diffDays} day(s) (${startDateStr} to ${endDateStr})\n• Total Price: ₹${pricing.total_price}${securityDeposit > 0 ? ` + ₹${securityDeposit} Deposit` : ''}\n• Direct P2P Payment on pickup\n${notes ? `• Note: "${notes}"` : ''}`;

    const { error: msgErr } = await supabaseAdmin.from('messages').insert([{
      sender_id: renterId,
      receiver_id: listing.owner_id,
      content: inquiryMsg,
      booking_id: cleanListingId,
      rental_request_id: rentalRequest.id,
      message_type: 'text',
      is_read: false,
      created_at: new Date().toISOString(),
    }]);

    if (msgErr) {
      console.error('[Rental Request Chat Insertion Error]:', msgErr.message, msgErr);
    }

    // Notify owner
    notifyUser(listing.owner_id, {
      title: 'New Rental Request Received! 📦',
      body: `${req.user.full_name || 'A user'} requested to rent "${listing.title}" for ${diffDays} day(s).`,
      data: {
        type: 'rental_request',
        rental_request_id: rentalRequest.id,
        listing_id: cleanListingId,
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
 * 4. Get Rental Request Details (Safe columns, phone masked unless accepted)
 */
const getRentalRequestById = async (req, res, next) => {
  try {
    const cleanId = validateUUID(req.params.id, 'rental_request_id');
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
      .eq('id', cleanId)
      .single();

    if (error || !rentalRequest) {
      return res.status(404).json({ success: false, error: 'Rental request not found.' });
    }

    if (rentalRequest.owner_id !== userId && rentalRequest.renter_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Unauthorized to view this rental request.' });
    }

    // Phone numbers only revealed once request is accepted
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
    const cleanId = validateUUID(req.params.id, 'rental_request_id');
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
      .eq('id', cleanId)
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
        owner_response_notes: owner_response || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cleanId)
      .select()
      .single();

    if (updateErr) {
      if (updateErr.code === '23P01' || updateErr.message?.includes('23P01') || updateErr.message?.includes('exclusion')) {
        return res.status(409).json({
          success: false,
          error: 'Cannot accept this request: Another accepted booking already overlaps with these dates.',
        });
      }
      return res.status(400).json({ success: false, error: updateErr.message });
    }

    // Send confirmation message in chat thread
    const statusMsg = status === 'accepted'
      ? `🎉 Rental Request ACCEPTED! Please coordinate direct pickup/handover and direct peer-to-peer payment.\n${owner_response ? `Owner Note: "${owner_response}"` : ''}`
      : `❌ Rental Request declined by owner.\n${owner_response ? `Reason: "${owner_response}"` : ''}`;

    const { error: msgErr } = await supabaseAdmin.from('messages').insert([{
      sender_id: ownerId,
      receiver_id: request.renter_id,
      content: statusMsg,
      booking_id: request.listing_id,
      rental_request_id: request.id,
      message_type: 'text',
      is_read: false,
      created_at: new Date().toISOString(),
    }]);

    if (msgErr) {
      console.error('[Chat Response Msg Error]:', msgErr.message);
    }

    // Notify Renter
    notifyUser(request.renter_id, {
      title: status === 'accepted' ? 'Rental Request Accepted! 🎉' : 'Rental Request Declined',
      body: `Your request for "${request.listing?.title || 'item'}" was ${status}.`,
      data: {
        type: 'rental_status_update',
        rental_request_id: cleanId,
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
 * 6. Cancel Rental Request (Renter or Owner, from 'pending' or 'accepted' only)
 * Phase 3.1: Notify the other party with both notification row and chat message
 */
const cancelRentalRequest = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const cleanId = validateUUID(req.params.id, 'rental_request_id');
    const { reason = 'Cancelled by user' } = req.body;

    const { data: request, error: findErr } = await supabaseAdmin
      .from('rental_requests')
      .select('*, listing:listings(title)')
      .eq('id', cleanId)
      .single();

    if (findErr || !request) {
      return res.status(404).json({ success: false, error: 'Rental request not found.' });
    }

    if (request.renter_id !== userId && request.owner_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Unauthorized to cancel this request.' });
    }

    // Cancel: only allowed from 'pending' or 'accepted'
    if (!['pending', 'accepted'].includes(request.request_status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot cancel a rental request with status '${request.request_status}'. Only pending or accepted requests can be cancelled.`,
      });
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('rental_requests')
      .update({
        request_status: 'cancelled',
        cancelled_by: userId,
        cancellation_reason: reason.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', cleanId)
      .select()
      .single();

    if (updateErr) {
      return res.status(400).json({ success: false, error: updateErr.message });
    }

    // Identify recipient party (the OTHER person)
    const otherUserId = userId === request.renter_id ? request.owner_id : request.renter_id;
    const cancelledByRole = userId === request.renter_id ? 'Renter' : 'Owner';

    // 1. Send chat message
    const cancelMsg = `⚠️ Rental request for "${request.listing?.title || 'item'}" was CANCELLED by ${cancelledByRole}.\nReason: "${reason}"`;
    const { error: msgErr } = await supabaseAdmin.from('messages').insert([{
      sender_id: userId,
      receiver_id: otherUserId,
      content: cancelMsg,
      booking_id: request.listing_id,
      rental_request_id: request.id,
      message_type: 'text',
      is_read: false,
      created_at: new Date().toISOString(),
    }]);

    if (msgErr) {
      console.error('[Cancel Rental Chat Msg Error]:', msgErr.message);
    }

    // 2. Send notification row & push
    notifyUser(otherUserId, {
      title: 'Rental Request Cancelled',
      body: `Rental request for "${request.listing?.title || 'item'}" was cancelled by ${cancelledByRole}.`,
      data: {
        type: 'rental_cancelled',
        rental_request_id: cleanId,
        cancelled_by: userId,
      },
    }).catch(err => console.warn('[FCM Notify Error]:', err.message));

    res.json({
      success: true,
      message: 'Rental request cancelled successfully.',
      rental_request: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 7. Complete Rental (POST /rentals/:id/complete)
 * Phase 3.1: Owner only, only from 'accepted', increments total_rentals for both, notifies renter
 */
const completeRentalRequest = async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const cleanId = validateUUID(req.params.id, 'rental_request_id');

    const { data: request, error: findErr } = await supabaseAdmin
      .from('rental_requests')
      .select('*, listing:listings(title)')
      .eq('id', cleanId)
      .single();

    if (findErr || !request) {
      return res.status(404).json({ success: false, error: 'Rental request not found.' });
    }

    // Owner only
    if (request.owner_id !== ownerId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only the listing owner can mark a rental as completed.',
      });
    }

    // Only allowed from 'accepted'
    if (request.request_status !== 'accepted') {
      return res.status(400).json({
        success: false,
        error: `Only accepted rentals can be marked as completed. Current status: '${request.request_status}'.`,
      });
    }

    const completedAt = new Date().toISOString();

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('rental_requests')
      .update({
        request_status: 'completed',
        completed_at: completedAt,
        updated_at: completedAt,
      })
      .eq('id', cleanId)
      .select()
      .single();

    if (updateErr) {
      return res.status(400).json({ success: false, error: updateErr.message });
    }

    // Increment total_rentals for both users
    const { data: ownerProf } = await supabaseAdmin
      .from('profiles')
      .select('total_rentals')
      .eq('id', request.owner_id)
      .maybeSingle();

    await supabaseAdmin
      .from('profiles')
      .update({ total_rentals: (ownerProf?.total_rentals || 0) + 1 })
      .eq('id', request.owner_id);

    const { data: renterProf } = await supabaseAdmin
      .from('profiles')
      .select('total_rentals')
      .eq('id', request.renter_id)
      .maybeSingle();

    await supabaseAdmin
      .from('profiles')
      .update({ total_rentals: (renterProf?.total_rentals || 0) + 1 })
      .eq('id', request.renter_id);

    // Send chat completion message
    const completeMsg = `✅ Rental of "${request.listing?.title || 'item'}" marked as COMPLETED! Both parties can now leave a verified peer review.`;
    const { error: msgErr } = await supabaseAdmin.from('messages').insert([{
      sender_id: ownerId,
      receiver_id: request.renter_id,
      content: completeMsg,
      booking_id: request.listing_id,
      rental_request_id: request.id,
      message_type: 'text',
      is_read: false,
      created_at: completedAt,
    }]);

    if (msgErr) {
      console.error('[Complete Rental Chat Msg Error]:', msgErr.message);
    }

    // Notify renter
    notifyUser(request.renter_id, {
      title: 'Rental Completed! 🌟',
      body: `Your rental of "${request.listing?.title || 'item'}" is completed. Leave a review for the owner!`,
      data: {
        type: 'rental_completed',
        rental_request_id: cleanId,
        listing_id: request.listing_id,
      },
    }).catch(err => console.warn('[FCM Notify Error]:', err.message));

    res.json({
      success: true,
      message: 'Rental completed successfully. Verified rental count updated.',
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
  completeRentalRequest,
  calculateRentalPrice,
};
