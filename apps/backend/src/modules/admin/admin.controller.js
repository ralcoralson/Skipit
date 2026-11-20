const { supabaseAdmin } = require('../../config/supabase');
const { sanitizeSearchText } = require('../../utils/filterSanitizer');

// 1. Dashboard Metrics
const getDashboardMetrics = async (req, res, next) => {
  try {
    const [
      { count: totalUsers },
      { count: totalListings },
      { count: activeListings },
      { count: pendingReports },
      { count: pendingKyc },
      { count: totalReviews },
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('listings').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('listings').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabaseAdmin.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('kyc_status', 'pending'),
      supabaseAdmin.from('reviews').select('*', { count: 'exact', head: true }),
    ]);

    res.json({
      success: true,
      metrics: {
        totalUsers: totalUsers || 0,
        totalListings: totalListings || 0,
        activeListings: activeListings || 0,
        pendingReports: pendingReports || 0,
        pendingKyc: pendingKyc || 0,
        totalReviews: totalReviews || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 2. User Management
const listUsers = async (req, res, next) => {
  try {
    const { q, role, is_banned, page = 1, limit = 25 } = req.query;
    const from = (parseInt(page) - 1) * parseInt(limit);
    const to = from + parseInt(limit) - 1;

    let query = supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact' });

    if (q) {
      const cleanQ = sanitizeSearchText(q);
      if (cleanQ) {
        query = query.or(`full_name.ilike.%${cleanQ}%,phone.ilike.%${cleanQ}%,location.ilike.%${cleanQ}%`);
      }
    }

    if (role) {
      query = query.eq('role', role);
    }

    if (is_banned !== undefined) {
      query = query.eq('is_banned', is_banned === 'true');
    }

    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data: users, count, error } = await query;

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      users: users || [],
      total: count || 0,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    next(error);
  }
};

// 3. Suspend / Reactivate User (Safeguards from Phase 1.11: No self-ban or admin-ban)
const toggleUserBan = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { is_banned, reason } = req.body;

    if (userId === req.user.id) {
      return res.status(400).json({ success: false, error: 'Administrators cannot suspend their own account' });
    }

    const { data: targetUser } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle();

    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (targetUser.role === 'admin') {
      return res.status(403).json({ success: false, error: 'Cannot suspend another administrator account' });
    }

    const { data: user, error } = await supabaseAdmin
      .from('profiles')
      .update({ is_banned: Boolean(is_banned) })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    // If banned, pause user's listings
    if (is_banned) {
      await supabaseAdmin
        .from('listings')
        .update({ is_active: false })
        .eq('owner_id', userId);
    }

    // Log to audit log
    await supabaseAdmin
      .from('audit_log')
      .insert([{
        actor_id: req.user.id,
        action: is_banned ? 'USER_SUSPENDED' : 'USER_REINSTATED',
        entity_type: 'profile',
        entity_id: userId,
        new_data: { reason },
        created_at: new Date().toISOString(),
      }]);

    res.json({
      success: true,
      message: `User account has been ${is_banned ? 'suspended' : 'reinstated'}`,
      user,
    });
  } catch (error) {
    next(error);
  }
};

// 3.1 Change User Role with Audit Log
const updateUserRole = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['user', 'moderator', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Role must be user, moderator, or admin' });
    }

    if (userId === req.user.id && role !== 'admin') {
      return res.status(400).json({ success: false, error: 'Cannot demote your own administrator account' });
    }

    const { data: targetUser } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle();

    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const oldRole = targetUser.role;

    const { data: user, error } = await supabaseAdmin
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    await supabaseAdmin
      .from('audit_log')
      .insert([{
        actor_id: req.user.id,
        action: 'USER_ROLE_CHANGED',
        entity_type: 'profile',
        entity_id: userId,
        old_data: { role: oldRole },
        new_data: { role },
        created_at: new Date().toISOString(),
      }]);

    res.json({
      success: true,
      message: `User role updated to ${role}`,
      user,
    });
  } catch (error) {
    next(error);
  }
};

// Helper: Generate short-lived signed URL (5 minutes) for KYC documents
const createKycSignedUrl = async (pathOrUrl) => {
  if (!pathOrUrl) return null;
  const objectPath = pathOrUrl.includes('/kyc-documents/')
    ? pathOrUrl.split('/kyc-documents/')[1].split('?')[0]
    : pathOrUrl;
  try {
    const { data } = await supabaseAdmin.storage
      .from('kyc-documents')
      .createSignedUrl(objectPath, 300);
    return data?.signedUrl || null;
  } catch (e) {
    return null;
  }
};

// 4. List KYC Verification Queue (Phase 1.6: 5-minute signed URLs for admin)
const listKycSubmissions = async (req, res, next) => {
  try {
    const { status = 'pending' } = req.query;

    const { data: users, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, phone, location, kyc_status, kyc_document_type, kyc_document_url, kyc_selfie_url, created_at, updated_at')
      .eq('kyc_status', status);

    if (error) {
      console.error('[listKycSubmissions Error]:', error);
      return res.status(400).json({ success: false, error: error.message });
    }

    // Generate 5-minute signed URLs for private KYC documents
    const formatted = await Promise.all((users || []).map(async (u) => {
      const docSignedUrl = await createKycSignedUrl(u.kyc_document_url);
      const selfieSignedUrl = await createKycSignedUrl(u.kyc_selfie_url);

      return {
        ...u,
        kyc_document_url: docSignedUrl,
        kyc_selfie_url: selfieSignedUrl,
      };
    }));

    res.json({ success: true, submissions: formatted });
  } catch (error) {
    next(error);
  }
};

// 4.1 Get Signed URLs for a specific user's KYC submission (Admin only, 5 min expiry)
const getKycSignedUrls = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { data: user, error } = await supabaseAdmin
      .from('profiles')
      .select('id, kyc_document_url, kyc_selfie_url, kyc_status')
      .eq('id', userId)
      .maybeSingle();

    if (error || !user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const docSignedUrl = await createKycSignedUrl(user.kyc_document_url);
    const selfieSignedUrl = await createKycSignedUrl(user.kyc_selfie_url);

    res.json({
      success: true,
      document_url: docSignedUrl,
      selfie_url: selfieSignedUrl,
      expires_in: 300,
    });
  } catch (error) {
    next(error);
  }
};

// 5. Review KYC Submission
const reviewKyc = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { status, notes } = req.body; // status: 'approved' | 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Status must be approved or rejected' });
    }

    const isApproved = status === 'approved';

    const { data: user, error } = await supabaseAdmin
      .from('profiles')
      .update({
        kyc_status: status,
        is_verified: isApproved,
        kyc_reviewed_at: new Date().toISOString(),
        kyc_reviewer_notes: notes || '',
        trust_score: isApproved ? 85 : 40,
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    // Send in-app notification to user
    await supabaseAdmin
      .from('notifications')
      .insert([{
        user_id: userId,
        type: 'system',
        title: isApproved ? 'Identity Verification Approved!' : 'Verification Update',
        body: isApproved
          ? 'Congratulations! Your identity has been verified. A verified badge is now displayed on your profile and listings.'
          : `Your identity verification could not be approved. Reason: ${notes || 'Please resubmit clearer documents.'}`,
        is_read: false,
      }]);

    res.json({
      success: true,
      message: `KYC submission ${status}`,
      user,
    });
  } catch (error) {
    next(error);
  }
};

// 6. Reports Management
const listReports = async (req, res, next) => {
  try {
    const { status = 'pending' } = req.query;

    const { data: reports, error } = await supabaseAdmin
      .from('reports')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.json({ success: true, reports: reports || [] });
  } catch (error) {
    next(error);
  }
};

// 7. Resolve Report
const resolveReport = async (req, res, next) => {
  try {
    const { reportId } = req.params;
    const { status, resolution_notes } = req.body; // 'resolved' | 'dismissed'

    const { data: report, error } = await supabaseAdmin
      .from('reports')
      .update({
        status: status || 'resolved',
      })
      .eq('id', reportId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      message: 'Report status updated',
      report,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardMetrics,
  listUsers,
  toggleUserBan,
  updateUserRole,
  listKycSubmissions,
  getKycSignedUrls,
  reviewKyc,
  listReports,
  resolveReport,
};
