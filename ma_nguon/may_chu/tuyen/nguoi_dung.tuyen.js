const express = require('express');
const userController = require('../bo_dieu_khien/nguoi_dung.bo_dieu_khien');
const { requireAuth } = require('../trung_gian/xac_thuc.trung_gian');

const router = express.Router();

router.use(requireAuth);
router.patch('/profile', userController.updateProfile);
router.get('/settings', userController.getSettings);
router.patch('/settings', userController.updateSettings);

module.exports = router;
