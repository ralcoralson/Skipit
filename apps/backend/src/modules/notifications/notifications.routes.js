const express = require('express');
const router = express.Router();
const notificationsController = require('./notifications.controller');
const { requireAuth } = require('../../middleware/auth');

router.get('/', requireAuth, notificationsController.getNotifications);
router.patch('/:id/read', requireAuth, notificationsController.markAsRead);
router.patch('/read-all', requireAuth, notificationsController.markAllAsRead);

// Device token endpoints supporting both REST standards
router.post('/device', requireAuth, notificationsController.registerDeviceToken);
router.post('/device/register', requireAuth, notificationsController.registerDeviceToken);
router.delete('/device', requireAuth, notificationsController.removeDeviceToken);
router.post('/device/remove', requireAuth, notificationsController.removeDeviceToken);

module.exports = router;
