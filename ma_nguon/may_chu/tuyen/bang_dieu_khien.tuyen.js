const express = require('express');
const dashboardController = require('../bo_dieu_khien/bang_dieu_khien.bo_dieu_khien');
const { requireAuth } = require('../trung_gian/xac_thuc.trung_gian');
const createRateLimit = require('../trung_gian/gioi_han_tan_suat.trung_gian');

const router = express.Router();
const publicDashboardLimit = createRateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Bạn tải dashboard quá nhanh. Vui lòng thử lại sau',
});

router.get('/public/:token', publicDashboardLimit, dashboardController.publicOverview);
router.get('/overview', requireAuth, dashboardController.overview);

module.exports = router;
