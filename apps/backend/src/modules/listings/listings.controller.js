const { supabaseAdmin } = require('../../config/supabase');
const { uploadToSupabaseStorage } = require('../../middleware/upload');
const { sanitizeSearchText, validateUUID } = require('../../utils/filterSanitizer');

// 1. Get Listings with Search, Filters, Sorting & Pagination
const getListings = async (req, res, next) => {
  try {
    const {
      q,
      category,
      condition,
      min_price,
      max_price,
      location,
      sort = 'recent',
      page = 1,
      limit = 20,
    } = req.query;

    const from = (parseInt(page) - 1) * parseInt(limit);
    const to = from + parseInt(limit) - 1;

    let query = supabaseAdmin
      .from('listings')
      .select('*, owner:profiles!listings_owner_id_fkey(id, full_name, avatar_url, rating, is_verified, trust_score)', { count: 'exact' })
      .eq('is_active', true);

    // Keyword search with filter injection protection
    if (q) {
      const cleanQ = sanitizeSearchText(q);
      if (cleanQ) {
        query = query.or(`title.ilike.%${cleanQ}%,description.ilike.%${cleanQ}%,location_name.ilike.%${cleanQ}%`);
      }
    }

    // Category filter
    if (category && category !== 'All') {
      query = query.ilike('category', `%${category}%`);
    }

    // Condition filter
    if (condition) {
      query = query.eq('condition', condition);
    }

    // Price range filter
    if (min_price) {
      query = query.gte('price_per_day', parseFloat(min_price));
    }
    if (max_price) {
      query = query.lte('price_per_day', parseFloat(max_price));
    }

    // Location filter
    if (location && location !== 'All India' && location !== 'All' && location !== 'All Cities') {
      const searchLoc = location.split(',')[0].trim();
      if (searchLoc.toLowerCase().includes('delhi') || searchLoc.toLowerCase().includes('ncr')) {
        query = query.or('location_name.ilike.%Delhi%,location_name.ilike.%Gurgaon%,location_name.ilike.%Noida%,location_name.ilike.%Haryana%');
      } else {
        query = query.ilike('location_name', `%${searchLoc}%`);
      }
    }

    // Sorting
    switch (sort) {
      case 'price_asc':
        query = query.order('price_per_day', { ascending: true });
        break;
      case 'price_desc':
        query = query.order('price_per_day', { ascending: false });
        break;
      case 'views':
        query = query.order('views_count', { ascending: false });
        break;
      case 'recent':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    query = query.range(from, to);

    const { data: listings, count, error } = await query;

    if (error) {
      // Fallback without join if foreign key naming differs
      const fallbackQuery = supabaseAdmin
        .from('listings')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .range(from, to);

      const fallbackResult = await fallbackQuery;
      return res.json({
        success: true,
        listings: fallbackResult.data || [],
        total: fallbackResult.count || 0,
        page: parseInt(page),
        limit: parseInt(limit),
      });
    }

    res.json({
      success: true,
      listings: listings || [],
      total: count || 0,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    next(error);
  }
};

// 2. Get Featured Listings
const getFeaturedListings = async (req, res, next) => {
  try {
    const { data: listings, error } = await supabaseAdmin
      .from('listings')
      .select('*')
      .eq('is_active', true)
      .limit(8)
      .order('views_count', { ascending: false });

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.json({ success: true, listings: listings || [] });
  } catch (error) {
    next(error);
  }
};

// 3. Get Listing by ID (with Owner & Reviews & Similar Listings)
const getListingById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: listing, error } = await supabaseAdmin
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !listing) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }

    // Increment views count asynchronously
    supabaseAdmin
      .from('listings')
      .update({ views_count: (listing.views_count || 0) + 1 })
      .eq('id', id)
      .then();

    // Fetch owner profile
    const { data: owner } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, avatar_url, bio, location, rating, trust_score, is_verified, total_rentals, total_listings, created_at')
      .eq('id', listing.owner_id)
      .maybeSingle();

    // Fetch reviews for this listing or owner
    const { data: reviews } = await supabaseAdmin
      .from('reviews')
      .select('*, reviewer:profiles!reviews_reviewer_id_fkey(id, full_name, avatar_url)')
      .eq('listing_id', id)
      .order('created_at', { ascending: false })
      .limit(5);

    // Fetch similar listings
    const { data: similarListings } = await supabaseAdmin
      .from('listings')
      .select('*')
      .eq('category', listing.category)
      .neq('id', id)
      .eq('is_active', true)
      .limit(4);

    // Check if in current user's wishlist
    let isWishlisted = false;
    if (req.user) {
      const { data: wish } = await supabaseAdmin
        .from('wishlists')
        .select('id')
        .eq('user_id', req.user.id)
        .eq('listing_id', id)
        .maybeSingle();
      if (wish) isWishlisted = true;
    }

    res.json({
      success: true,
      listing: {
        ...listing,
        owner: owner || { id: listing.owner_id, full_name: 'SkipIt Host' },
        reviews: reviews || [],
        similarListings: similarListings || [],
        is_wishlisted: isWishlisted,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 4. Create Listing
const createListing = async (req, res, next) => {
  try {
    const {
      title,
      description,
      price_per_day,
      price_per_hour,
      price_per_week,
      price_per_month,
      pricing_unit = 'daily',
      deposit_amount = 0,
      deposit_details,
      category,
      brand,
      model,
      condition = 'good',
      location_name,
      location_lat,
      location_lng,
      delivery_options,
      rental_terms,
      contact_preference = 'chat_only',
      min_rental_days = 1,
      max_rental_days = 30,
    } = req.body;

    if (!title || !description || !price_per_day || !category || !location_name) {
      return res.status(400).json({
        success: false,
        error: 'Title, description, category, price per day, and location are required',
      });
    }

    let imageUrls = [];

    // Process uploaded image files if any
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const url = await uploadToSupabaseStorage(file, 'listing-images', req.user.id);
        imageUrls.push(url);
      }
    } else if (req.body.images) {
      // Support array of strings if already uploaded
      imageUrls = Array.isArray(req.body.images) ? req.body.images : [req.body.images];
    }

    // Fallback placeholder image if none provided
    if (imageUrls.length === 0) {
      imageUrls = ['https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=800&q=80'];
    }

    const listingPayload = {
      owner_id: req.user.id,
      title,
      description,
      price_per_day: parseFloat(price_per_day),
      deposit_amount: parseFloat(deposit_amount || 0),
      category,
      condition,
      images: imageUrls,
      location_name,
      location_lat: location_lat ? parseFloat(location_lat) : null,
      location_lng: location_lng ? parseFloat(location_lng) : null,
      delivery_options: typeof delivery_options === 'string' ? JSON.parse(delivery_options) : (delivery_options || { pickup: true, delivery: false }),
      min_rental_days: parseInt(min_rental_days) || 1,
      max_rental_days: parseInt(max_rental_days) || 30,
      is_available: true,
      is_active: true,
      views_count: 0,
      created_at: new Date().toISOString(),
    };

    const { data: newListing, error } = await supabaseAdmin
      .from('listings')
      .insert([listingPayload])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    // Increment owner's total_listings count
    supabaseAdmin
      .from('profiles')
      .update({ total_listings: (req.user.total_listings || 0) + 1 })
      .eq('id', req.user.id)
      .then();

    res.status(201).json({
      success: true,
      message: 'Listing published successfully',
      listing: newListing,
    });
  } catch (error) {
    next(error);
  }
};

// 5. Update Listing
const updateListing = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check ownership
    const { data: existing, error: findError } = await supabaseAdmin
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !existing) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }

    if (existing.owner_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Not authorized to edit this listing' });
    }

    // Role guard: Only admins may change is_active or is_featured
    if ((req.body.is_active !== undefined || req.body.is_featured !== undefined) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators may alter is_active or is_featured listing status',
      });
    }

    const updates = { ...req.body };
    delete updates.id;
    delete updates.owner_id;
    delete updates.views_count;
    delete updates.saves_count;
    delete updates.created_at;

    // Process new images if uploaded
    if (req.files && req.files.length > 0) {
      const newUrls = [];
      for (const file of req.files) {
        const url = await uploadToSupabaseStorage(file, 'listing-images', req.user.id);
        newUrls.push(url);
      }
      updates.images = [...(existing.images || []), ...newUrls];
    }

    const { data: updated, error } = await supabaseAdmin
      .from('listings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      message: 'Listing updated successfully',
      listing: updated,
    });
  } catch (error) {
    next(error);
  }
};

// 6. Toggle Pause / Active Status
const toggleListingStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: existing } = await supabaseAdmin
      .from('listings')
      .select('owner_id, is_available, is_active')
      .eq('id', id)
      .single();

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }

    if (existing.owner_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const newStatus = !existing.is_available;

    const { data: updated, error } = await supabaseAdmin
      .from('listings')
      .update({ is_available: newStatus })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      message: `Listing is now ${newStatus ? 'active and available' : 'paused'}`,
      listing: updated,
    });
  } catch (error) {
    next(error);
  }
};

// 7. Delete Listing
const deleteListing = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: existing } = await supabaseAdmin
      .from('listings')
      .select('owner_id')
      .eq('id', id)
      .single();

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }

    if (existing.owner_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const { error } = await supabaseAdmin
      .from('listings')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      message: 'Listing removed successfully',
    });
  } catch (error) {
    next(error);
  }
};

// 8. Get Current User's Listings
const getMyListings = async (req, res, next) => {
  try {
    const { data: listings, error } = await supabaseAdmin
      .from('listings')
      .select('*')
      .eq('owner_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      listings: listings || [],
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getListings,
  getFeaturedListings,
  getListingById,
  createListing,
  updateListing,
  toggleListingStatus,
  deleteListing,
  getMyListings,
};
