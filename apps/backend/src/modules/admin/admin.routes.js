const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { requireAuth } = require('../../middleware/auth');
const { requireAdmin, requireModeratorOrAdmin } = require('../../middleware/rbac');

// All admin routes require authentication and elevated role
router.use(requireAuth);

router.get('/metrics', requireModeratorOrAdmin, adminController.getDashboardMetrics);
router.get('/users', requireModeratorOrAdmin, adminController.listUsers);
router.patch('/users/:userId/ban', requireAdmin, adminController.toggleUserBan);
router.patch('/users/:userId/role', requireAdmin, adminController.updateUserRole);
router.get('/kyc/submissions', requireModeratorOrAdmin, adminController.listKycSubmissions);
router.get('/kyc/submissions/:userId/signed-urls', requireAdmin, adminController.getKycSignedUrls);
router.patch('/kyc/submissions/:userId/review', requireAdmin, adminController.reviewKyc);
router.get('/reports', requireModeratorOrAdmin, adminController.listReports);
router.patch('/reports/:reportId/resolve', requireModeratorOrAdmin, adminController.resolveReport);

module.exports = router;
