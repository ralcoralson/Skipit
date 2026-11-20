const express = require('express');
const router = express.Router();
const listingsController = require('./listings.controller');
const { requireAuth, optionalAuth } = require('../../middleware/auth');
const { upload } = require('../../middleware/upload');
const { validate, createListingSchema, updateListingSchema } = require('../../middleware/validate');

// Public listing discovery
router.get('/', optionalAuth, listingsController.getListings);
router.get('/featured', listingsController.getFeaturedListings);
router.get('/my/all', requireAuth, listingsController.getMyListings);
router.get('/:id', optionalAuth, listingsController.getListingById);

// Owner actions
router.post('/', requireAuth, upload.array('images', 8), validate(createListingSchema), listingsController.createListing);
router.put('/:id', requireAuth, upload.array('images', 8), validate(updateListingSchema), listingsController.updateListing);
router.patch('/:id/toggle-status', requireAuth, listingsController.toggleListingStatus);
router.delete('/:id', requireAuth, listingsController.deleteListing);

module.exports = router;
