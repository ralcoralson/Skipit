const { supabaseAdmin } = require('../../config/supabase');
const { validateUUID } = require('../../utils/filterSanitizer');

/**
 * 1. Block a User (Phase 3.2: User blocking system)
 * POST /users/:id/block
 */
const blockUser = async (req, res, next) => {
  try {
    const blockerId = req.user.id;
    const blockedId = validateUUID(req.params.id, 'user_id');
    const { reason = 'User blocked' } = req.body;

    if (blockerId === blockedId) {
      return res.status(400).json({ success: false, error: 'You cannot block your own account' });
    }

    // Verify target user exists
    const { data: targetUser } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .eq('id', blockedId)
      .maybeSingle();

    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Upsert block record
    const { data: blockRecord, error } = await supabaseAdmin
      .from('user_blocks')
      .upsert({
        blocker_id: blockerId,
        blocked_id: blockedId,
        reason: reason.trim(),
        created_at: new Date().toISOString(),
      }, { onConflict: 'blocker_id,blocked_id' })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      message: `User ${targetUser.full_name || 'member'} has been blocked`,
      block: blockRecord,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Unblock a User
 * DELETE /users/:id/block
 */
const unblockUser = async (req, res, next) => {
  try {
    const blockerId = req.user.id;
    const blockedId = validateUUID(req.params.id, 'user_id');

    const { error } = await supabaseAdmin
      .from('user_blocks')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId);

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      message: 'User has been unblocked successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 3. List Blocked Users for Current User
 * GET /users/blocked
 */
const getBlockedUsers = async (req, res, next) => {
  try {
    const blockerId = req.user.id;

    const { data: blocks, error } = await supabaseAdmin
      .from('user_blocks')
      .select(`
        id,
        blocked_id,
        reason,
        created_at,
        blocked:profiles!user_blocks_blocked_id_fkey(id, full_name, avatar_url, location)
      `)
      .eq('blocker_id', blockerId)
      .order('created_at', { ascending: false });

    if (error) {
      // Fallback without join
      const { data: rawBlocks } = await supabaseAdmin
        .from('user_blocks')
        .select('*')
        .eq('blocker_id', blockerId);

      return res.json({
        success: true,
        blocked_users: rawBlocks || [],
      });
    }

    res.json({
      success: true,
      blocked_users: blocks || [],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Get Public User Profile (Hides sensitive KYC & private columns)
 * GET /users/:id
 */
const getUserPublicProfile = async (req, res, next) => {
  try {
    const userId = validateUUID(req.params.id, 'user_id');

    const { data: profile, error } = await supabaseAdmin
      .from('profiles_public')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error || !profile) {
      // Fallback to profiles table with safe column selection
      const { data: fallback } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, avatar_url, bio, location, rating, trust_score, is_verified, total_rentals, total_listings, total_reviews, created_at')
        .eq('id', userId)
        .eq('is_banned', false)
        .maybeSingle();

      if (!fallback) {
        return res.status(404).json({ success: false, error: 'User profile not found' });
      }

      return res.json({ success: true, profile: fallback });
    }

    res.json({ success: true, profile });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  blockUser,
  unblockUser,
  getBlockedUsers,
  getUserPublicProfile,
};
