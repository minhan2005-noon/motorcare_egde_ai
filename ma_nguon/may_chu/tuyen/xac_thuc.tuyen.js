const express = require('express');
const authController = require('../bo_dieu_khien/xac_thuc.bo_dieu_khien');
const { requireAuth } = require('../trung_gian/xac_thuc.trung_gian');
const validate = require('../trung_gian/kiem_tra.trung_gian');
const createRateLimit = require('../trung_gian/gioi_han_tan_suat.trung_gian');
const authValidator = require('../kiem_tra/xac_thuc.kiem_tra');

const router = express.Router();
const authLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Bạn thao tác quá nhiều lần. Vui lòng thử lại sau',
});

router.post('/register', authLimit, validate(authValidator.register), authController.register);
router.post('/login', authLimit, validate(authValidator.login), authController.login);
router.post(
  '/forgot-password',
  authLimit,
  validate(authValidator.forgotPassword),
  authController.forgotPassword,
);
router.post(
  '/verify-reset-code',
  authLimit,
  validate(authValidator.verifyResetCode),
  authController.verifyResetCode,
);
router.post(
  '/reset-password',
  authLimit,
  validate(authValidator.resetPassword),
  authController.resetPassword,
);
router.get('/me', requireAuth, authController.me);
router.post('/logout', requireAuth, authController.logout);
router.post('/logout-all', requireAuth, authController.logoutAll);
router.post(
  '/change-password',
  requireAuth,
  validate(authValidator.changePassword),
  authController.changePassword,
);

module.exports = router;
