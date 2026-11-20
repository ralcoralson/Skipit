#!/usr/bin/env node

/**
 * SkipIt 3.0 Database Schema Verification Script
 * Checks all required tables, columns, and views against the Supabase database.
 * Prints MISSING lines and exits non-zero if any expected table or column is missing.
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const EXPECTED_SCHEMA = {
  profiles: [
    'id', 'full_name', 'email', 'phone', 'phone_number', 'avatar_url', 'bio',
    'location', 'role', 'rating', 'trust_score', 'is_verified', 'is_banned',
    'kyc_status', 'kyc_document_type', 'kyc_document_url', 'kyc_selfie_url',
    'kyc_reviewed_at', 'kyc_reviewer_notes', 'total_rentals', 'total_listings',
    'total_reviews', 'saved_addresses', 'created_at', 'updated_at',
  ],
  listings: [
    'id', 'owner_id', 'title', 'description', 'price_per_day', 'price_per_hour',
    'price_per_week', 'price_per_month', 'pricing_unit', 'deposit_amount',
    'deposit_details', 'category', 'subcategory', 'brand', 'model', 'condition',
    'images', 'location_name', 'location_lat', 'location_lng', 'pickup_options',
    'delivery_options', 'rental_terms', 'contact_preference', 'min_rental_days',
    'max_rental_days', 'is_available', 'is_active', 'is_featured', 'views_count',
    'saves_count', 'created_at', 'updated_at',
  ],
  rental_requests: [
    'id', 'listing_id', 'renter_id', 'owner_id', 'start_date', 'end_date',
    'total_days', 'total_price', 'deposit_amount', 'price_breakdown',
    'request_status', 'renter_notes', 'owner_response', 'owner_response_notes',
    'cancelled_by', 'cancellation_reason', 'completed_at', 'created_at', 'updated_at',
  ],
  messages: [
    'id', 'sender_id', 'receiver_id', 'content', 'booking_id', 'rental_request_id',
    'message_type', 'attachment_url', 'is_read', 'created_at',
  ],
  reviews: [
    'id', 'reviewer_id', 'reviewee_id', 'listing_id', 'rental_request_id',
    'rating', 'comment', 'is_verified_rental', 'created_at',
  ],
  otp_sessions: [
    'id', 'phone', 'code_hash', 'attempts', 'expires_at', 'consumed_at', 'created_at',
  ],
  device_tokens: [
    'id', 'user_id', 'token', 'platform', 'created_at', 'last_seen_at',
  ],
  user_blocks: [
    'id', 'blocker_id', 'blocked_id', 'reason', 'created_at',
  ],
  support_tickets: [
    'id', 'user_id', 'subject', 'message', 'category', 'priority', 'status',
    'admin_notes', 'created_at', 'updated_at',
  ],
  categories: [
    'id', 'name', 'slug', 'icon', 'subcategories', 'is_active',
  ],
  reports: [
    'id', 'reporter_id', 'reported_user_id', 'listing_id', 'reason',
    'description', 'status', 'resolution_notes', 'created_at',
  ],
  wishlists: [
    'id', 'user_id', 'listing_id', 'created_at',
  ],
  audit_log: [
    'id', 'actor_id', 'action', 'entity_type', 'entity_id', 'old_data', 'new_data', 'created_at',
  ],
};

const UNUSED_TABLES = ['conversations', 'listing_images'];

async function verify() {
  console.log('🔍 Verifying database schema against application contract...\n');
  let missingCount = 0;

  for (const [table, columns] of Object.entries(EXPECTED_SCHEMA)) {
    // 1. Check table existence
    const { error: tableErr } = await supabase.from(table).select('*').limit(0);
    if (tableErr) {
      console.error(`MISSING TABLE: ${table} (${tableErr.message})`);
      missingCount += columns.length + 1;
      continue;
    }

    console.log(`✓ Table '${table}' exists`);

    // 2. Check each expected column
    for (const column of columns) {
      const { error: colErr } = await supabase.from(table).select(column).limit(0);
      if (colErr && (colErr.code === '42703' || colErr.message?.includes('does not exist') || colErr.message?.includes('schema cache'))) {
        console.error(`  MISSING COLUMN: ${table}.${column}`);
        missingCount++;
      }
    }
  }

  // 3. Check public view
  const { error: viewErr } = await supabase.from('profiles_public').select('*').limit(0);
  if (viewErr) {
    console.error(`MISSING VIEW: profiles_public (${viewErr.message})`);
    missingCount++;
  } else {
    console.log(`✓ View 'profiles_public' exists`);
  }

  // 4. Report unused legacy tables
  console.log('\n📋 Unused Legacy Tables (Retained safely without deletion):');
  for (const t of UNUSED_TABLES) {
    const { error: checkErr } = await supabase.from(t).select('*').limit(0);
    if (!checkErr) {
      console.log(`  - ${t} (Present in DB, not referenced by current API layer)`);
    } else {
      console.log(`  - ${t} (Not present in DB)`);
    }
  }

  console.log('\n' + '='.repeat(60));
  if (missingCount > 0) {
    console.error(`❌ Verification failed: ${missingCount} schema item(s) are missing.`);
    console.error('Apply infrastructure/supabase/migrations/20261118000000_reconcile_schema.sql to resolve.');
    process.exit(1);
  } else {
    console.log('✅ Schema verification passed! All tables and columns match the application contract.');
    process.exit(0);
  }
}

verify().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
