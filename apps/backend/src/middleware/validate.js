const { z } = require('zod');

/**
 * Higher-order middleware to validate req.body, req.query, or req.params against a Zod schema.
 * Handles both Zod v3 (err.errors) and Zod v4 (err.issues) safely, ensuring all validation
 * failures return HTTP 400 Bad Request with formatted field details.
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const issues = err.issues || err.errors || [];
        return res.status(400).json({
          success: false,
          error: 'Input validation failed',
          details: issues.map((e) => ({
            field: Array.isArray(e.path) ? e.path.join('.') : String(e.path || ''),
            message: e.message,
          })),
        });
      }
      next(err);
    }
  };
};

// Common Schemas
const sendOtpSchema = z.object({
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
});

const verifyOtpSchema = z.object({
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  otp: z.string().length(6, 'Verification code must be exactly 6 digits'),
  full_name: z.string().optional(),
});

const createListingSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(150),
  description: z.string().min(10, 'Description must be at least 10 characters').max(3000),
  price_per_day: z.coerce.number().positive('Daily price must be greater than 0'),
  deposit_amount: z.coerce.number().min(0, 'Deposit cannot be negative').default(0),
  category: z.string().min(2, 'Category is required'),
  location_name: z.string().min(2, 'Location is required'),
  condition: z.enum(['brand_new', 'like_new', 'good', 'fair']).default('good'),
  brand: z.string().optional(),
  model: z.string().optional(),
});

/**
 * Update Listing Schema (Phase 1.3: Mass Assignment Protection)
 * Strictly allows only 23 whitelisted mutable listing attributes plus admin flags.
 * Disallows views_count, saves_count, created_at, owner_id.
 */
const updateListingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  price_per_day: z.coerce.number().positive().optional(),
  price_per_hour: z.coerce.number().positive().optional().nullable(),
  price_per_week: z.coerce.number().positive().optional().nullable(),
  price_per_month: z.coerce.number().positive().optional().nullable(),
  pricing_unit: z.string().optional().nullable(),
  deposit_amount: z.coerce.number().min(0).optional().nullable(),
  deposit_details: z.string().optional().nullable(),
  category: z.string().optional(),
  subcategory: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  condition: z.string().optional(),
  location_name: z.string().optional(),
  location_lat: z.coerce.number().optional().nullable(),
  location_lng: z.coerce.number().optional().nullable(),
  pickup_options: z.any().optional().nullable(),
  delivery_options: z.any().optional().nullable(),
  rental_terms: z.string().optional().nullable(),
  contact_preference: z.string().optional().nullable(),
  min_rental_days: z.coerce.number().int().min(1).optional().nullable(),
  max_rental_days: z.coerce.number().int().min(1).optional().nullable(),
  is_available: z.preprocess((val) => (val === 'true' ? true : val === 'false' ? false : val), z.boolean().optional()),
  is_active: z.preprocess((val) => (val === 'true' ? true : val === 'false' ? false : val), z.boolean().optional()),
  is_featured: z.preprocess((val) => (val === 'true' ? true : val === 'false' ? false : val), z.boolean().optional()),
}).strict('Mass assignment violation: Unpermitted field passed to updateListing');

const inquirySchema = z.object({
  listing_id: z.string().uuid('Invalid listing ID format'),
  initial_message: z.string().max(1000).optional(),
});

const reportSchema = z.object({
  reason: z.string().min(3, 'Reason must be at least 3 characters'),
  description: z.string().optional(),
  reported_user_id: z.string().uuid().optional(),
  listing_id: z.string().uuid().optional(),
});

module.exports = {
  validate,
  sendOtpSchema,
  verifyOtpSchema,
  createListingSchema,
  updateListingSchema,
  inquirySchema,
  reportSchema,
};
