const { supabaseAdmin } = require('../../config/supabase');

const createReview = async (req, res, next) => {
  try {
    const { reviewee_id, rental_request_id, listing_id, rating, comment } = req.body;

    if (!reviewee_id || !rating || !comment) {
      return res.status(400).json({
        success: false,
        error: 'reviewee_id, rating (1-5), and comment are required',
      });
    }

    if (reviewee_id === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'You cannot review yourself',
      });
    }

    const numRating = parseInt(rating, 10);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' });
    }

    // Phase 1.9: Review gating - Require a completed rental_requests row
    if (!rental_request_id) {
      return res.status(403).json({
        success: false,
        error: 'A completed rental_request_id is required to submit a verified review',
      });
    }

    const { data: rental, error: rentalErr } = await supabaseAdmin
      .from('rental_requests')
      .select('id, owner_id, renter_id, listing_id, request_status')
      .eq('id', rental_request_id)
      .maybeSingle();

    if (rentalErr || !rental) {
      return res.status(403).json({
        success: false,
        error: 'Associated rental request was not found',
      });
    }

    if (rental.request_status !== 'completed') {
      return res.status(403).json({
        success: false,
        error: 'Only completed rentals can be reviewed. Current status: ' + rental.request_status,
      });
    }

    // Validate that reviewer and reviewee are counterpart parties of this rental
    const isRenterReviewingOwner = rental.renter_id === req.user.id && rental.owner_id === reviewee_id;
    const isOwnerReviewingRenter = rental.owner_id === req.user.id && rental.renter_id === reviewee_id;

    if (!isRenterReviewingOwner && !isOwnerReviewingRenter) {
      return res.status(403).json({
        success: false,
        error: 'You may only review the peer counter-party of your completed rental agreement',
      });
    }

    // Allow exactly one review per rental per reviewer
    const { data: existingReview } = await supabaseAdmin
      .from('reviews')
      .select('id')
      .eq('rental_request_id', rental_request_id)
      .eq('reviewer_id', req.user.id)
      .maybeSingle();

    if (existingReview) {
      return res.status(400).json({
        success: false,
        error: 'You have already submitted a review for this completed rental',
      });
    }

    const reviewPayload = {
      reviewer_id: req.user.id,
      reviewee_id,
      rental_request_id: rental.id,
      listing_id: rental.listing_id || listing_id || null,
      rating: numRating,
      comment: comment.trim(),
      is_verified_rental: true,
      created_at: new Date().toISOString(),
    };

    const { data: review, error } = await supabaseAdmin
      .from('reviews')
      .insert([reviewPayload])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    // Recalculate target user's average rating, review count, and weighted trust score
    const { data: allReviews } = await supabaseAdmin
      .from('reviews')
      .select('rating')
      .eq('reviewee_id', reviewee_id);

    if (allReviews && allReviews.length > 0) {
      const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
      // Controlled trust score: Base 50 + rating quality (up to 25) + verified volume (up to 25)
      const ratingBonus = (avg / 5) * 25;
      const volumeBonus = Math.min(25, allReviews.length * 2.5);
      const calculatedTrustScore = Math.min(100, Math.round(50 + ratingBonus + volumeBonus));

      await supabaseAdmin
        .from('profiles')
        .update({
          rating: parseFloat(avg.toFixed(1)),
          total_reviews: allReviews.length,
          trust_score: calculatedTrustScore,
        })
        .eq('id', reviewee_id);
    }

    // Notify reviewee
    supabaseAdmin
      .from('notifications')
      .insert([{
        user_id: reviewee_id,
        type: 'review',
        title: 'New Review Received',
        body: `${req.user.full_name || 'A user'} gave you a ${numRating}-star review!`,
        data: { reviewer_id: req.user.id, rating: numRating },
        is_read: false,
      }])
      .then();

    res.status(201).json({
      success: true,
      message: 'Review posted successfully',
      review,
    });
  } catch (error) {
    next(error);
  }
};

const getReviewsForUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const { data: reviews, error } = await supabaseAdmin
      .from('reviews')
      .select('*, reviewer:profiles!reviews_reviewer_id_fkey(id, full_name, avatar_url)')
      .eq('reviewee_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      // Fallback without join
      const { data: rawReviews } = await supabaseAdmin
        .from('reviews')
        .select('*')
        .eq('reviewee_id', userId)
        .order('created_at', { ascending: false });

      return res.json({ success: true, reviews: rawReviews || [] });
    }

    res.json({
      success: true,
      reviews: reviews || [],
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReview,
  getReviewsForUser,
};
