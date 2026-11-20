const path = require('path');
const dotenv = require('dotenv');

// Load root .env or local .env
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const rawNodeEnv = process.env.NODE_ENV;
// Treat unset NODE_ENV as production per Phase 1.7 requirement
const isExplicitDevOrTest = rawNodeEnv === 'development' || rawNodeEnv === 'test';
const nodeEnv = rawNodeEnv || 'production';
const isProduction = !isExplicitDevOrTest;

const jwtSecret = process.env.JWT_SECRET || (nodeEnv === 'test' ? 'test_jwt_secret_must_be_at_least_32_chars_long' : '');
const supabaseUrl = process.env.SUPABASE_URL || (nodeEnv === 'test' ? 'https://mock.supabase.co' : '');
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || (nodeEnv === 'test' ? 'mock_anon_key' : '');
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || (nodeEnv === 'test' ? 'mock_service_key' : '');

// Server hardening checks for production (and when NODE_ENV is unset)
if (isProduction) {
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error(
      `[FATAL SECURITY] In production, JWT_SECRET must be set and must be at least 32 characters long. Current length: ${jwtSecret ? jwtSecret.length : 0}`
    );
  }
  if (!supabaseUrl) {
    throw new Error('[FATAL SECURITY] In production, SUPABASE_URL must be defined.');
  }
  if (!supabaseServiceRoleKey) {
    throw new Error('[FATAL SECURITY] In production, SUPABASE_SERVICE_ROLE_KEY must be defined.');
  }
}

const googleClientIds = (process.env.GOOGLE_CLIENT_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

const corsOrigin = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  wsPort: parseInt(process.env.WS_PORT, 10) || 5001,
  nodeEnv,
  isProduction,
  jwtSecret,
  enableDevOtp: process.env.ENABLE_DEV_OTP === 'true' && !isProduction,
  googleClientIds,
  supabase: {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
    serviceRoleKey: supabaseServiceRoleKey,
  },
  corsOrigin,
};

module.exports = config;
