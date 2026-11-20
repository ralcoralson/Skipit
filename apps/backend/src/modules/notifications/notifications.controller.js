const { supabaseAdmin } = require('../../config/supabase');

const getNotifications = async (req, res, next) => {
  try {
    const { data: notifications, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      notifications: notifications || [],
    });
  } catch (error) {
    next(error);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
};

const markAllAsRead = async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', req.user.id)
      .eq('is_read', false);

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};

// 4. Register Device Token for Push Notifications (Phase 2.2 & 3.3)
const registerDeviceToken = async (req, res, next) => {
  try {
    const { token, platform = 'android' } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Device token is required' });
    }

    const userId = req.user.id;
    const cleanToken = token.trim();

    // Upsert into dedicated device_tokens table
    const { data: record, error } = await supabaseAdmin
      .from('device_tokens')
      .upsert({
        user_id: userId,
        token: cleanToken,
        platform: String(platform).toLowerCase(),
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'token' })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      message: 'Device token registered successfully',
      device: record,
    });
  } catch (error) {
    next(error);
  }
};

// 5. Remove Device Token on Logout or Uninstall (Phase 2.2 & 3.3)
const removeDeviceToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Device token is required' });
    }

    const userId = req.user.id;
    const cleanToken = token.trim();

    const { error } = await supabaseAdmin
      .from('device_tokens')
      .delete()
      .eq('token', cleanToken)
      .eq('user_id', userId);

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.json({ success: true, message: 'Device token removed successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  registerDeviceToken,
  removeDeviceToken,
};
