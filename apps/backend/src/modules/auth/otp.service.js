const crypto = require('crypto');
const config = require('../../config/env');
const { supabaseAdmin } = require('../../config/supabase');

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_OTP_ATTEMPTS = 3;

// In-memory cache fallback for fast local development
const memoryOtpCache = new Map();

/**
 * Hash OTP with application secret to prevent plain-text exposure
 */
const hashOtp = (phone, otp) => {
  return crypto
    .createHmac('sha256', config.jwtSecret || 'fallback_skipit_otp_hmac_secret_key_32_chars')
    .update(`${phone}:${otp}`)
    .digest('hex');
};

/**
 * Send real SMS through configured provider
 */
const dispatchSms = async (phone, otp) => {
  const provider = (process.env.SMS_PROVIDER || 'mock').toLowerCase();
  const message = `Your SkipIt verification code is ${otp}. Valid for 5 minutes. Do not share this code.`;

  try {
    switch (provider) {
      case 'twilio': {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_PHONE_NUMBER;

        if (!accountSid || !authToken || !fromNumber) {
          throw new Error('Twilio credentials missing in environment');
        }

        const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
        const params = new URLSearchParams();
        params.append('To', phone);
        params.append('From', fromNumber);
        params.append('Body', message);

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${authHeader}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
          }
        );

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Twilio SMS failed (${response.status}): ${errText}`);
        }
        console.log(`[SMS Engine] Twilio SMS dispatched successfully to ${phone}`);
        return { success: true, provider: 'twilio' };
      }

      case 'msg91': {
        const authKey = process.env.MSG91_AUTH_KEY;
        const templateId = process.env.MSG91_TEMPLATE_ID;

        if (!authKey || !templateId) {
          throw new Error('Msg91 credentials or template ID missing in environment');
        }

        const cleanPhone = phone.replace(/\D/g, '');
        const response = await fetch('https://api.msg91.com/api/v5/otp', {
          method: 'POST',
          headers: {
            'authkey': authKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            template_id: templateId,
            mobile: cleanPhone,
            otp: otp,
          }),
        });

        const resData = await response.json();
        if (resData.type === 'error') {
          throw new Error(`Msg91 error: ${resData.message}`);
        }
        console.log(`[SMS Engine] Msg91 OTP dispatched successfully to ${phone}`);
        return { success: true, provider: 'msg91' };
      }

      case 'fast2sms': {
        const apiKey = process.env.FAST2SMS_API_KEY;
        if (!apiKey) throw new Error('Fast2SMS API key missing in environment');

        const cleanPhone = phone.replace(/\D/g, '').slice(-10);
        const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            'authorization': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            route: 'otp',
            variables_values: otp,
            numbers: cleanPhone,
          }),
        });

        const resData = await response.json();
        if (!resData.return) {
          throw new Error(`Fast2SMS error: ${resData.message}`);
        }
        console.log(`[SMS Engine] Fast2SMS OTP dispatched successfully to ${cleanPhone}`);
        return { success: true, provider: 'fast2sms' };
      }

      case 'mock':
      default: {
        if (config.isProduction) {
          console.warn('[SECURITY WARNING] SMS_PROVIDER is set to mock in production. Set SMS_PROVIDER to real carrier delivery.');
        } else {
          console.log(`[SMS Engine Mock] Generated OTP for ${phone}: ${otp}`);
        }
        return { success: true, provider: 'mock' };
      }
    }
  } catch (error) {
    console.error(`[SMS Engine Error] Failed to send SMS to ${phone}:`, error.message);
    throw error;
  }
};

/**
 * Generate and store a new secure OTP in dedicated otp_sessions table (Phase 1.8)
 */
const generateAndStoreOtp = async (phone) => {
  const otp = crypto.randomInt(100000, 1000000).toString();
  const hashed = hashOtp(phone, otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS).toISOString();

  // 1. Store in memory cache
  memoryOtpCache.set(phone, {
    phone,
    code_hash: hashed,
    expires_at: expiresAt,
    attempts: 0,
    created_at: new Date().toISOString(),
  });

  // 2. Persist in dedicated otp_sessions table
  try {
    await supabaseAdmin.from('otp_sessions').insert([{
      phone,
      code_hash: hashed,
      attempts: 0,
      expires_at: expiresAt,
      consumed_at: null,
      created_at: new Date().toISOString(),
    }]);
  } catch (e) {
    console.warn('[OTP Sessions Persistence Warning]:', e.message);
  }

  // 3. Dispatch via SMS provider
  await dispatchSms(phone, otp);

  // Return dev OTP ONLY if ENABLE_DEV_OTP=true AND NODE_ENV is not production
  const returnDevOtp = config.enableDevOtp;

  return {
    expiresInSeconds: Math.floor(OTP_EXPIRY_MS / 1000),
    devOtp: returnDevOtp ? otp : undefined,
  };
};

/**
 * Verify OTP with dedicated otp_sessions table, attempt throttling, expiry, and replay defense
 */
const verifyStoredOtp = async (phone, submittedOtp) => {
  const isDevAllowed = config.enableDevOtp;

  // 1. Query dedicated otp_sessions table for latest unconsumed session
  let session = null;
  try {
    const { data: records, error } = await supabaseAdmin
      .from('otp_sessions')
      .select('*')
      .eq('phone', phone)
      .is('consumed_at', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!error && records && records.length > 0) {
      session = records[0];
    }
  } catch (e) {
    console.warn('[OTP Sessions Query Warning]:', e.message);
  }

  // Fallback to memory cache if DB unavailable (e.g. offline unit testing)
  if (!session) {
    session = memoryOtpCache.get(phone);
  }

  if (!session) {
    // Only in development if explicitly configured
    if (isDevAllowed && submittedOtp === '123456') {
      console.log(`[OTP Verification] Accepted dev code 123456 for ${phone} (Development Mode Only)`);
      return { valid: true };
    }
    return { valid: false, error: 'No active OTP verification session found. Please request a new code.' };
  }

  // 2. Check Expiry
  const expiryTime = new Date(session.expires_at).getTime();
  if (Date.now() > expiryTime) {
    memoryOtpCache.delete(phone);
    return { valid: false, error: 'Verification code has expired. Please request a new code.' };
  }

  // 3. Check Attempt Limits
  if (session.attempts >= MAX_OTP_ATTEMPTS) {
    memoryOtpCache.delete(phone);
    return {
      valid: false,
      error: 'Maximum verification attempts exceeded. For security, please request a new OTP.',
    };
  }

  // 4. Update attempt count in DB
  const nextAttempts = (session.attempts || 0) + 1;
  session.attempts = nextAttempts;
  if (session.id) {
    await supabaseAdmin
      .from('otp_sessions')
      .update({ attempts: nextAttempts })
      .eq('id', session.id);
  }

  // 5. Compare Hashed OTP securely
  const submittedHash = hashOtp(phone, submittedOtp);
  let isMatch = false;
  try {
    isMatch = crypto.timingSafeEqual(
      Buffer.from(submittedHash, 'hex'),
      Buffer.from(session.code_hash, 'hex')
    );
  } catch (cmpErr) {
    isMatch = false;
  }

  const devCodeMatch = isDevAllowed && submittedOtp === '123456';

  if (!isMatch && !devCodeMatch) {
    const remaining = Math.max(0, MAX_OTP_ATTEMPTS - nextAttempts);
    return {
      valid: false,
      error: `Invalid verification code. ${remaining} attempt(s) remaining.`,
    };
  }

  // 6. Mark session as consumed to prevent replay attacks
  if (session.id) {
    await supabaseAdmin
      .from('otp_sessions')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', session.id);
  }
  memoryOtpCache.delete(phone);

  return { valid: true };
};

module.exports = {
  generateAndStoreOtp,
  verifyStoredOtp,
};
