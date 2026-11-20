const express = require('express');
const router = express.Router();
const rentalsController = require('./rentals.controller');
const { requireAuth } = require('../../middleware/auth');

// All rental operations require an authenticated user
router.use(requireAuth);

router.post('/', rentalsController.createRentalRequest);
router.get('/my-requests', rentalsController.getMyRequests);
router.get('/incoming', rentalsController.getIncomingRequests);
router.get('/:id', rentalsController.getRentalRequestById);
router.patch('/:id/respond', rentalsController.respondRentalRequest);
router.post('/:id/respond', rentalsController.respondRentalRequest);
router.patch('/:id/cancel', rentalsController.cancelRentalRequest);
router.post('/:id/cancel', rentalsController.cancelRentalRequest);
router.post('/:id/complete', rentalsController.completeRentalRequest);
router.patch('/:id/complete', rentalsController.completeRentalRequest);

module.exports = router;
