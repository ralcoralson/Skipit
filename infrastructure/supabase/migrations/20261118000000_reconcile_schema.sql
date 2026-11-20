-- =====================================================================
-- Migration: 20261118000000_reconcile_schema.sql
-- Description: Comprehensive schema reconciliation for SkipIt 3.0
-- Idempotent: Uses ALTER TABLE ... ADD COLUMN IF NOT EXISTS throughout
-- =====================================================================

-- 0. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- =====================================================================
-- 1. PROFILES TABLE RECONCILIATION
-- =====================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  phone_number text,
  avatar_url text,
  bio text,
  location text DEFAULT 'Bengaluru, India',
  role text DEFAULT 'user',
  rating numeric DEFAULT 5.0,
  trust_score integer DEFAULT 50,
  is_verified boolean DEFAULT false,
  is_banned boolean DEFAULT false,
  kyc_status text DEFAULT 'unverified',
  kyc_document_type text,
  kyc_document_url text,
  kyc_selfie_url text,
  kyc_reviewed_at timestamptz,
  kyc_reviewer_notes text,
  total_rentals integer DEFAULT 0,
  total_listings integer DEFAULT 0,
  total_reviews integer DEFAULT 0,
  saved_addresses jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location text DEFAULT 'Bengaluru, India';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rating numeric DEFAULT 5.0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trust_score integer DEFAULT 50;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_status text DEFAULT 'unverified';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_document_type text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_document_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_selfie_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_reviewed_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_reviewer_notes text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_rentals integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_listings integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_reviews integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS saved_addresses jsonb DEFAULT '{}'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Fix kyc_status CHECK constraint ('unverified', 'pending', 'approved', 'rejected')
DO $$
BEGIN
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_kyc_status_check;
  -- Update any legacy 'none' to 'unverified'
  UPDATE profiles SET kyc_status = 'unverified' WHERE kyc_status = 'none' OR kyc_status IS NULL;
  ALTER TABLE profiles ADD CONSTRAINT profiles_kyc_status_check 
    CHECK (kyc_status IN ('unverified', 'pending', 'approved', 'rejected'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Phase 1.5a: Secure public profiles view (hides KYC, phone, email, and private metadata)
CREATE OR REPLACE VIEW profiles_public AS
SELECT
  id,
  full_name,
  avatar_url,
  bio,
  location,
  rating,
  trust_score,
  is_verified,
  total_rentals,
  total_listings,
  total_reviews,
  created_at
FROM profiles
WHERE is_banned = false;

-- =====================================================================
-- 2. OTP SESSIONS TABLE (Dedicated storage for SMS/OTP verification)
-- =====================================================================
CREATE TABLE IF NOT EXISTS otp_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code_hash text NOT NULL,
  attempts integer DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE otp_sessions ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE otp_sessions ADD COLUMN IF NOT EXISTS code_hash text;
ALTER TABLE otp_sessions ADD COLUMN IF NOT EXISTS attempts integer DEFAULT 0;
ALTER TABLE otp_sessions ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE otp_sessions ADD COLUMN IF NOT EXISTS consumed_at timestamptz;
ALTER TABLE otp_sessions ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_otp_sessions_phone ON otp_sessions(phone);
CREATE INDEX IF NOT EXISTS idx_otp_sessions_unconsumed ON otp_sessions(phone, consumed_at, expires_at);

-- RLS: Service role only
ALTER TABLE otp_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public access to otp_sessions" ON otp_sessions;
CREATE POLICY "Deny all public access to otp_sessions" ON otp_sessions
  FOR ALL TO public USING (false);

-- =====================================================================
-- 3. DEVICE TOKENS TABLE (Phase 2.2: Push notification device registry)
-- =====================================================================
CREATE TABLE IF NOT EXISTS device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  platform text DEFAULT 'android',
  created_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now()
);

ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS token text;
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS platform text DEFAULT 'android';
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_tokens_token ON device_tokens(token);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own device tokens" ON device_tokens;
CREATE POLICY "Users can manage their own device tokens" ON device_tokens
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =====================================================================
-- 4. USER BLOCKS TABLE (Phase 1.10 & 3.2: User blocking system)
-- =====================================================================
CREATE TABLE IF NOT EXISTS user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_blocks ADD COLUMN IF NOT EXISTS blocker_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE user_blocks ADD COLUMN IF NOT EXISTS blocked_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE user_blocks ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE user_blocks ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_blocks_unique ON user_blocks(blocker_id, blocked_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);

ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view and manage their own blocks" ON user_blocks;
CREATE POLICY "Users can view and manage their own blocks" ON user_blocks
  FOR ALL TO authenticated
  USING (auth.uid() = blocker_id)
  WITH CHECK (auth.uid() = blocker_id);

-- =====================================================================
-- 5. LISTINGS TABLE RECONCILIATION
-- =====================================================================
CREATE TABLE IF NOT EXISTS listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  price_per_day numeric NOT NULL,
  price_per_hour numeric,
  price_per_week numeric,
  price_per_month numeric,
  pricing_unit text DEFAULT 'day',
  deposit_amount numeric DEFAULT 0,
  deposit_details text,
  category text NOT NULL,
  subcategory text,
  brand text,
  model text,
  condition text DEFAULT 'good',
  images text[] DEFAULT '{}'::text[],
  location_name text NOT NULL,
  location_lat double precision,
  location_lng double precision,
  pickup_options jsonb DEFAULT '{"pickup": true, "dropoff": true}'::jsonb,
  delivery_options jsonb DEFAULT '{"available": false}'::jsonb,
  rental_terms text,
  contact_preference text,
  min_rental_days integer DEFAULT 1,
  max_rental_days integer DEFAULT 30,
  is_available boolean DEFAULT true,
  is_active boolean DEFAULT true,
  is_featured boolean DEFAULT false,
  views_count integer DEFAULT 0,
  saves_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE listings ADD COLUMN IF NOT EXISTS price_per_hour numeric;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS price_per_week numeric;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS price_per_month numeric;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS pricing_unit text DEFAULT 'day';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS deposit_details text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS subcategory text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS brand text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS condition text DEFAULT 'good';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS location_lat double precision;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS location_lng double precision;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS pickup_options jsonb DEFAULT '{"pickup": true, "dropoff": true}'::jsonb;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS delivery_options jsonb DEFAULT '{"available": false}'::jsonb;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS rental_terms text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS contact_preference text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS min_rental_days integer DEFAULT 1;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS max_rental_days integer DEFAULT 30;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS is_available boolean DEFAULT true;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS views_count integer DEFAULT 0;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS saves_count integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_listings_owner_id ON listings(owner_id);
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
CREATE INDEX IF NOT EXISTS idx_listings_active ON listings(is_active) WHERE is_active = true;

-- =====================================================================
-- 6. RENTAL REQUESTS TABLE RECONCILIATION & DATE EXCLUSION (Phase 2.3)
-- =====================================================================
CREATE TABLE IF NOT EXISTS rental_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  renter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_days integer NOT NULL,
  total_price numeric NOT NULL,
  deposit_amount numeric DEFAULT 0,
  price_breakdown jsonb DEFAULT '{}'::jsonb,
  request_status text DEFAULT 'pending',
  renter_notes text,
  owner_response text,
  owner_response_notes text,
  cancelled_by uuid REFERENCES profiles(id),
  cancellation_reason text,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS total_days integer;
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS total_price numeric;
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS deposit_amount numeric DEFAULT 0;
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS price_breakdown jsonb DEFAULT '{}'::jsonb;
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS request_status text DEFAULT 'pending';
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS renter_notes text;
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS owner_response text;
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS owner_response_notes text;
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES profiles(id);
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Performance indexes required by 2.3
CREATE INDEX IF NOT EXISTS idx_rental_requests_owner_id ON rental_requests(owner_id);
CREATE INDEX IF NOT EXISTS idx_rental_requests_renter_id ON rental_requests(renter_id);
CREATE INDEX IF NOT EXISTS idx_rental_requests_dates ON rental_requests(listing_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_rental_requests_status ON rental_requests(request_status);

-- Phase 2.3: Btree_gist exclusion constraint on ACCEPTED rental requests
DO $$
BEGIN
  ALTER TABLE rental_requests DROP CONSTRAINT IF EXISTS no_overlapping_accepted_rentals;
  ALTER TABLE rental_requests
    ADD CONSTRAINT no_overlapping_accepted_rentals
    EXCLUDE USING gist (
      listing_id WITH =,
      daterange(start_date, end_date, '[]') WITH &&
    )
    WHERE (request_status = 'accepted');
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not create exclusion constraint: %', SQLERRM;
END $$;

-- =====================================================================
-- 7. MESSAGES TABLE RECONCILIATION
-- =====================================================================
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  booking_id uuid,
  rental_request_id uuid REFERENCES rental_requests(id) ON DELETE SET NULL,
  message_type text DEFAULT 'text',
  attachment_url text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS booking_id uuid;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS rental_request_id uuid REFERENCES rental_requests(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'text';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_url text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_rental_request ON messages(rental_request_id);

-- =====================================================================
-- 8. REVIEWS TABLE RECONCILIATION (Phase 1.9: Gating & Unique Constraint)
-- =====================================================================
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  rental_request_id uuid REFERENCES rental_requests(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text NOT NULL,
  is_verified_rental boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS listing_id uuid REFERENCES listings(id) ON DELETE SET NULL;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS rental_request_id uuid REFERENCES rental_requests(id) ON DELETE CASCADE;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_verified_rental boolean DEFAULT true;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Unique index: One review per rental per reviewer
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_one_per_rental 
  ON reviews(rental_request_id, reviewer_id)
  WHERE rental_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);

-- =====================================================================
-- 9. SUPPORT TICKETS TABLE RECONCILIATION (Phase 5.2 & 5.3)
-- =====================================================================
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject text NOT NULL,
  message text NOT NULL,
  category text DEFAULT 'general',
  priority text DEFAULT 'medium',
  status text DEFAULT 'open',
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS category text DEFAULT 'general';
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium';
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS status text DEFAULT 'open';
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS admin_notes text;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

-- =====================================================================
-- 10. AUDIT LOG & REPORTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  reason text NOT NULL,
  description text,
  status text DEFAULT 'pending',
  resolution_notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wishlists_unique ON wishlists(user_id, listing_id);
