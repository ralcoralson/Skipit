/**
 * Filter Sanitizer & Parameter Security Helper
 * Prevents PostgREST / Supabase filter injection attacks across queries.
 */

/**
 * Strips characters that alter Supabase/PostgREST filter strings:
 * commas (,), parentheses (()), asterisks (*), backslashes (\), and percent signs (%).
 * Caps search length at 100 characters.
 *
 * @param {string} input - Raw user search input
 * @returns {string} - Sanitized search string safe for PostgREST .ilike queries
 */
function sanitizeSearchText(input) {
  if (typeof input !== 'string') return '';
  // Strip , ( ) * \ %
  const stripped = input.replace(/[,()*\\%]/g, '');
  return stripped.trim().slice(0, 100);
}

/**
 * Normalizes phone numbers to digits with optional leading '+'.
 * Rejects any non-digit character (aside from an optional leading '+').
 * Requires at least 10 digits and at most 15 digits (E.164 compliant).
 *
 * @param {string} phone - Raw input phone number
 * @returns {string} - Clean normalized phone string (e.g., "+919876543210" or "9876543210")
 * @throws {Error} - With status 400 if invalid
 */
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') {
    const err = new Error('Phone number is required and must be a valid string');
    err.status = 400;
    throw err;
  }

  const trimmed = phone.trim();
  // Valid format: optional leading '+', followed by 10 to 15 digits only
  const validPhoneRegex = /^\+?[0-9]{10,15}$/;
  if (!validPhoneRegex.test(trimmed)) {
    const err = new Error('Invalid phone number format. Must contain 10-15 digits with optional leading +.');
    err.status = 400;
    throw err;
  }

  return trimmed;
}

/**
 * Validates that an ID is a valid RFC 4122 UUID v4/v1.
 * Prevents injection in parameters passed to queries.
 *
 * @param {string} id - UUID string
 * @returns {string} - Verified UUID
 * @throws {Error} - With status 400 if invalid
 */
function validateUUID(id, paramName = 'id') {
  if (!id || typeof id !== 'string') {
    const err = new Error(`Invalid ${paramName}: must be a non-empty string`);
    err.status = 400;
    throw err;
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id.trim())) {
    const err = new Error(`Invalid ${paramName} format: must be a valid UUID`);
    err.status = 400;
    throw err;
  }
  return id.trim();
}

module.exports = {
  sanitizeSearchText,
  normalizePhone,
  validateUUID,
};
