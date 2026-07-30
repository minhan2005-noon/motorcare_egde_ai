const express = require('express');
const calibrationController = require('../bo_dieu_khien/hieu_chuan.bo_dieu_khien');
const { requireAuth } = require('../trung_gian/xac_thuc.trung_gian');

const router = express.Router();

router.use(requireAuth);
router.get('/motors/:motorId', calibrationController.list);
router.post('/motors/:motorId', calibrationController.create);

module.exports = router;
