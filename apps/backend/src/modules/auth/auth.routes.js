const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { requireAuth } = require('../../middleware/auth');
const { authLimiter } = require('../../middleware/rateLimiter');
const { upload, kycUpload } = require('../../middleware/upload');
const { validate, sendOtpSchema, verifyOtpSchema } = require('../../middleware/validate');

// Auth routes
router.post('/google', authLimiter, authController.googleAuth);
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/otp/send', authLimiter, validate(sendOtpSchema), authController.sendOtp);
router.post('/otp/verify', authLimiter, validate(verifyOtpSchema), authController.verifyOtp);

// Authenticated profile actions
router.get('/me', requireAuth, authController.getMe);
router.put('/profile', requireAuth, authController.updateProfile);
router.post('/avatar', requireAuth, upload.single('avatar'), authController.uploadAvatar);
router.post(
  '/kyc/submit',
  requireAuth,
  kycUpload.fields([
    { name: 'document', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
  ]),
  authController.submitKyc
);
router.delete('/account', requireAuth, authController.deleteAccount);

module.exports = router;
