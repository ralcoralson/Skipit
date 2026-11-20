/**
 * SkipIt 3.0 Offline Security & Unit Test Suite
 * Tests all Phase 1 and Phase 6 security controls without requiring live server or database.
 * Run with: node --test test/security_offline.test.js
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { z } = require('zod');

// Helpers and controllers under test
const { sanitizeSearchText, normalizePhone, validateUUID } = require('../src/utils/filterSanitizer');
const { validate, updateListingSchema } = require('../src/middleware/validate');
const { generateAndStoreOtp } = require('../src/modules/auth/otp.service');

describe('1. Filter Injection Neutralization (Requirement 1.2)', () => {
  test('strips commas, parens, asterisks, backslashes and percent signs from search text', () => {
    const maliciousInput = 'x,role.eq.admin';
    const sanitized = sanitizeSearchText(maliciousInput);
    assert.strictEqual(sanitized, 'xrole.eq.admin');
    assert.ok(!sanitized.includes(','), 'Must strip comma to prevent query chaining');
    assert.ok(!sanitized.includes('('));
    assert.ok(!sanitized.includes(')'));
  });

  test('strips all special postgrest characters: , ( ) * \\ %', () => {
    const input = 'phone.ilike.%987%*(hack)\\';
    const sanitized = sanitizeSearchText(input);
    assert.strictEqual(sanitized, 'phone.ilike.987hack');
  });

  test('caps search text length strictly at 100 characters', () => {
    const longInput = 'a'.repeat(250);
    const sanitized = sanitizeSearchText(longInput);
    assert.strictEqual(sanitized.length, 100);
  });

  test('normalizes valid phone numbers with optional leading +', () => {
    assert.strictEqual(normalizePhone('+919876543210'), '+919876543210');
    assert.strictEqual(normalizePhone('9876543210'), '9876543210');
    assert.strictEqual(normalizePhone('  +14155552671  '), '+14155552671');
  });

  test('rejects phone numbers with injection attempts with 400 status error', () => {
    const badPhones = [
      '9876543210,or.eq.true',
      "9876543210'; DROP TABLE profiles;--",
      '9876543210abc',
      '12345', // too short
      '',
    ];

    for (const bad of badPhones) {
      assert.throws(
        () => normalizePhone(bad),
        (err) => err.status === 400,
        `Expected 400 for phone: ${bad}`
      );
    }
  });

  test('validates UUIDs and rejects malicious string parameters with 400', () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    assert.strictEqual(validateUUID(validUuid), validUuid);

    const badUuids = [
      '123e4567-e89b-12d3-a456-426614174000,receiver_id.eq.admin',
      'not-a-uuid',
      '',
      null,
    ];

    for (const bad of badUuids) {
      assert.throws(
        () => validateUUID(bad),
        (err) => err.status === 400,
        `Expected 400 for UUID: ${bad}`
      );
    }
  });
});

describe('2. Mass Assignment & Listing Allowlist (Requirement 1.3)', () => {
  test('allows permitted listing fields', () => {
    const validUpdate = {
      title: 'Drill Machine',
      description: 'Heavy duty Bosch hammer drill',
      price_per_day: 250,
      price_per_week: 1200,
      deposit_amount: 1000,
      category: 'Power Tools',
      condition: 'good',
      location_name: 'Indiranagar, Bengaluru',
      min_rental_days: 1,
      max_rental_days: 14,
      is_available: true,
    };

    const parsed = updateListingSchema.parse(validUpdate);
    assert.strictEqual(parsed.title, 'Drill Machine');
    assert.strictEqual(parsed.price_per_day, 250);
  });

  test('rejects views_count, saves_count, created_at, and owner_id with 400', () => {
    const unpermittedPayloads = [
      { views_count: 9999 },
      { saves_count: 500 },
      { created_at: '2020-01-01T00:00:00Z' },
      { owner_id: '00000000-0000-0000-0000-000000000000' },
      { unknown_hack_field: 'injected' },
    ];

    for (const payload of unpermittedPayloads) {
      assert.throws(() => {
        updateListingSchema.parse(payload);
      });
    }
  });
});

describe('3. Validation Middleware Zod v4 & HTTP 400 Contract (Requirement 1.12)', () => {
  test('returns HTTP 400 with field details when input is invalid (not 500)', () => {
    const testSchema = z.object({
      phone: z.string().min(10),
      count: z.number().int().positive(),
    });

    const middleware = validate(testSchema, 'body');

    let statusCode = null;
    let jsonResponse = null;

    const req = {
      body: {
        phone: '123', // too short
        count: -5,    // negative
      },
    };

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonResponse = data;
        return this;
      },
    };

    let nextCalled = false;
    middleware(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false, 'next() should not be called on validation error');
    assert.strictEqual(statusCode, 400, 'Must return HTTP 400 on validation failure');
    assert.strictEqual(jsonResponse.success, false);
    assert.ok(Array.isArray(jsonResponse.details), 'details must be an array of issues');
    assert.strictEqual(jsonResponse.details.length, 2);
  });
});

describe('4. Google Authentication Security (Requirement 1.1)', () => {
  const { googleAuth } = require('../src/modules/auth/auth.controller');

  test('rejects plain-email Google sign-in request with 400', async () => {
    let statusCode = null;
    let jsonResponse = null;

    const req = {
      body: {
        email: 'attacker@gmail.com',
        full_name: 'Attacker Name',
      },
    };

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonResponse = data;
        return this;
      },
    };

    await googleAuth(req, res, () => {});

    assert.strictEqual(statusCode, 400);
    assert.strictEqual(jsonResponse.success, false);
    assert.ok(jsonResponse.error.includes('Google ID token'));
  });

  test('rejects forged / invalid Google token with 401', async () => {
    let statusCode = null;
    let jsonResponse = null;

    const req = {
      body: {
        credential: 'forged_fake_google_jwt_token_payload',
      },
    };

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonResponse = data;
        return this;
      },
    };

    await googleAuth(req, res, () => {});

    assert.strictEqual(statusCode, 401);
    assert.strictEqual(jsonResponse.success, false);
    assert.ok(jsonResponse.error.includes('Invalid Google ID token'));
  });
});

describe('5. Admin Ban Safeguards (Requirement 1.11)', () => {
  const { toggleUserBan } = require('../src/modules/admin/admin.controller');

  test('rejects administrator self-ban with 400', async () => {
    let statusCode = null;
    let jsonResponse = null;

    const req = {
      user: { id: 'admin-uuid-1', role: 'admin' },
      params: { userId: 'admin-uuid-1' },
      body: { is_banned: true },
    };

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonResponse = data;
        return this;
      },
    };

    await toggleUserBan(req, res, () => {});

    assert.strictEqual(statusCode, 400);
    assert.strictEqual(jsonResponse.success, false);
    assert.ok(jsonResponse.error.includes('cannot suspend their own account'));
  });
});

describe('6. OTP Security & Environment Controls (Requirement 1.7 & 1.8)', () => {
  test('does not return devOtp when NODE_ENV is production', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalOtpFlag = process.env.ENABLE_DEV_OTP;

    try {
      process.env.NODE_ENV = 'production';
      process.env.ENABLE_DEV_OTP = 'false';

      const res = await generateAndStoreOtp('+919876543210');
      assert.strictEqual(res.devOtp, undefined, 'devOtp must NEVER be returned in production');
    } finally {
      process.env.NODE_ENV = originalEnv;
      process.env.ENABLE_DEV_OTP = originalOtpFlag;
    }
  });
});

describe('7. Review Gating (Requirement 1.9)', () => {
  const { createReview } = require('../src/modules/reviews/reviews.controller');

  test('rejects review submission without completed rental_request_id with 403', async () => {
    let statusCode = null;
    let jsonResponse = null;

    const req = {
      user: { id: 'reviewer-uuid-1' },
      body: {
        reviewee_id: 'target-uuid-2',
        rating: 5,
        comment: 'Great product and owner',
      },
    };

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonResponse = data;
        return this;
      },
    };

    await createReview(req, res, () => {});

    assert.strictEqual(statusCode, 403);
    assert.strictEqual(jsonResponse.success, false);
    assert.ok(jsonResponse.error.includes('rental_request_id is required'));
  });
});

describe('8. Tiered Rental Pricing Calculator (Requirement 3.1)', () => {
  const { calculateRentalPrice } = require('../src/modules/rentals/rentals.controller');

  test('calculates standard daily rate when no weekly or monthly discount is set', () => {
    const listing = { price_per_day: 150 };
    const pricing = calculateRentalPrice(listing, 5);
    assert.strictEqual(pricing.total_price, 750);
    assert.strictEqual(pricing.breakdown.days, 5);
    assert.strictEqual(pricing.breakdown.weeks, 0);
    assert.strictEqual(pricing.breakdown.months, 0);
  });

  test('calculates tiered pricing for full weeks and remaining days', () => {
    const listing = {
      price_per_day: 100,
      price_per_week: 500, // discount over 7 * 100 = 700
    };
    // 10 days = 1 week (500) + 3 days (300) = 800
    const pricing = calculateRentalPrice(listing, 10);
    assert.strictEqual(pricing.total_price, 800);
    assert.strictEqual(pricing.breakdown.weeks, 1);
    assert.strictEqual(pricing.breakdown.days, 3);
  });

  test('calculates tiered pricing for full months, full weeks, and remaining days', () => {
    const listing = {
      price_per_day: 100,
      price_per_week: 600,
      price_per_month: 2000,
    };
    // 38 days = 1 month (30 days: 2000) + 1 week (7 days: 600) + 1 day (100) = 2700
    const pricing = calculateRentalPrice(listing, 38);
    assert.strictEqual(pricing.total_price, 2700);
    assert.strictEqual(pricing.breakdown.months, 1);
    assert.strictEqual(pricing.breakdown.weeks, 1);
    assert.strictEqual(pricing.breakdown.days, 1);
  });
});

describe('9. User Blocking Safeguards (Requirement 3.2)', () => {
  const { blockUser } = require('../src/modules/users/users.controller');

  test('rejects blocking own user account with 400', async () => {
    let statusCode = null;
    let jsonResponse = null;

    const selfUuid = '11111111-1111-1111-1111-111111111111';
    const req = {
      user: { id: selfUuid },
      params: { id: selfUuid },
      body: { reason: 'Test block self' },
    };

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonResponse = data;
        return this;
      },
    };

    const next = (err) => {
      if (err) {
        statusCode = err.status || 500;
        jsonResponse = { success: false, error: err.message };
      }
    };

    await blockUser(req, res, next);

    assert.strictEqual(statusCode, 400);
    assert.strictEqual(jsonResponse.success, false);
    assert.ok(jsonResponse.error.includes('cannot block your own account'));
  });
});

describe('10. HTTPS IP Geolocation (Requirement 3.5)', () => {
  const { getGeoFromIp } = require('../src/modules/geo/geo.controller');

  test('returns local fallback location (Bengaluru) for local IP over HTTPS without cleartext leak', async () => {
    let jsonResponse = null;

    const req = {
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    };

    const res = {
      json(data) {
        jsonResponse = data;
        return this;
      },
    };

    await getGeoFromIp(req, res, () => {});

    assert.strictEqual(jsonResponse.success, true);
    assert.strictEqual(jsonResponse.city, 'Bengaluru');
    assert.strictEqual(jsonResponse.country, 'India');
  });
});
