const express = require('express');
const dashboardController = require('../bo_dieu_khien/bang_dieu_khien.bo_dieu_khien');
const { requireAuth } = require('../trung_gian/xac_thuc.trung_gian');

const router = express.Router();

router.get('/overview', requireAuth, dashboardController.overview);

module.exports = router;
