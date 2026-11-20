const express = require('express');
const router = express.Router();
const usersController = require('./users.controller');
const { requireAuth, optionalAuth } = require('../../middleware/auth');

// Public profile view
router.get('/:id', optionalAuth, usersController.getUserPublicProfile);

// Blocking actions (authenticated)
router.get('/blocked', requireAuth, usersController.getBlockedUsers);
router.post('/:id/block', requireAuth, usersController.blockUser);
router.delete('/:id/block', requireAuth, usersController.unblockUser);

module.exports = router;
