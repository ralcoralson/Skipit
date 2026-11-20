const admin = require('firebase-admin');
const { supabaseAdmin } = require('../../config/supabase');

let fcmInitialized = false;

// Initialize Firebase Admin SDK safely
const initFirebase = () => {
  if (fcmInitialized) return true;

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!serviceAccount) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[FCM] FIREBASE_SERVICE_ACCOUNT_JSON is not configured in production environment. Push notifications running in fallback mode.');
    } else {
      console.log('[FCM] Firebase Admin running in development fallback mode');
    }
    return false;
  }

  try {
    let credentialData;
    if (serviceAccount.trim().startsWith('{')) {
      credentialData = JSON.parse(serviceAccount);
    } else {
      const fs = require('fs');
      const path = require('path');
      const resolvedPath = path.resolve(serviceAccount);
      if (!fs.existsSync(resolvedPath)) {
        console.warn(`[FCM] Firebase service account file not found at: ${resolvedPath}`);
        return false;
      }
      credentialData = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
    }

    const certAuth = admin.cert ? admin.cert(credentialData) : admin.credential.cert(credentialData);
    admin.initializeApp({
      credential: certAuth,
    });

    fcmInitialized = true;
    console.log('✅ [FCM] Firebase Cloud Messaging Admin SDK successfully initialized');
    return true;
  } catch (error) {
    console.error('[FCM Initialization Error]:', error.message);
    return false;
  }
};

// Attempt initialization on startup
initFirebase();

/**
 * Remove dead or expired tokens from dedicated device_tokens table (Phase 2.2)
 */
const cleanupExpiredTokens = async (expiredTokens = []) => {
  if (!Array.isArray(expiredTokens) || expiredTokens.length === 0) return;

  try {
    const { error } = await supabaseAdmin
      .from('device_tokens')
      .delete()
      .in('token', expiredTokens);

    if (error) {
      console.warn('[FCM Cleanup Error]:', error.message);
    } else {
      console.log(`[FCM Token Purged]: Pruned ${expiredTokens.length} expired device token(s) from device_tokens table.`);
    }
  } catch (err) {
    console.warn('[FCM Token Cleanup Exception]:', err.message);
  }
};

/**
 * Send push notification to target device tokens
 * Automatically handles removal of stale or expired registration tokens
 */
const sendPushNotification = async (deviceTokens = [], { title, body, data = {} }) => {
  if (!Array.isArray(deviceTokens) || deviceTokens.length === 0) {
    return { success: false, reason: 'No device tokens provided' };
  }

  const isReady = initFirebase();
  if (!isReady) {
    console.log(`[FCM Mock Push] Simulated push to ${deviceTokens.length} devices: "${title}" - "${body}"`);
    return { success: true, simulated: true };
  }

  try {
    // Stringify all data values as required by FCM
    const sanitizedData = {};
    for (const [key, val] of Object.entries(data)) {
      sanitizedData[key] = typeof val === 'string' ? val : JSON.stringify(val);
    }

    const messagePayload = {
      notification: {
        title,
        body,
      },
      data: sanitizedData,
      tokens: deviceTokens,
    };

    const response = await admin.messaging().sendEachForMulticast(messagePayload);
    console.log(`[FCM Push] Sent: ${response.successCount} succeeded, ${response.failureCount} failed.`);

    // Handle token cleanup for invalid or unregistered tokens
    if (response.failureCount > 0) {
      const expiredTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errCode = resp.error?.code;
          if (
            errCode === 'messaging/registration-token-not-registered' ||
            errCode === 'messaging/invalid-registration-token'
          ) {
            expiredTokens.push(deviceTokens[idx]);
          }
        }
      });

      if (expiredTokens.length > 0) {
        await cleanupExpiredTokens(expiredTokens);
      }
    }

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    console.error('[FCM Dispatch Error]:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Dispatch rental alert to a user (reads user's registered device_tokens, records in-app notification)
 */
const notifyUser = async (userId, { title, body, data = {} }) => {
  try {
    // 1. Record persistent in-app notification in Supabase
    await supabaseAdmin.from('notifications').insert([{
      user_id: userId,
      type: data.type || 'system',
      title,
      body,
      data,
      is_read: false,
      created_at: new Date().toISOString(),
    }]);

    // 2. Fetch user's registered devices from dedicated device_tokens table (Phase 2.2)
    const { data: rows, error: tokenErr } = await supabaseAdmin
      .from('device_tokens')
      .select('token')
      .eq('user_id', userId);

    if (tokenErr) {
      console.warn('[FCM Fetch Tokens Warning]:', tokenErr.message);
      return;
    }

    const deviceTokens = (rows || []).map((r) => r.token).filter(Boolean);

    if (deviceTokens.length > 0) {
      await sendPushNotification(deviceTokens, { title, body, data });
    }
  } catch (err) {
    console.warn('[User Notification Error]:', err.message);
  }
};

module.exports = {
  sendPushNotification,
  notifyUser,
  initFirebase,
  cleanupExpiredTokens,
};
