const express = require('express');
const alertController = require('../bo_dieu_khien/canh_bao.bo_dieu_khien');
const { requireAuth } = require('../trung_gian/xac_thuc.trung_gian');

const router = express.Router();

router.use(requireAuth);
router.get('/', alertController.list);
router.patch('/:id/status', alertController.changeStatus);

module.exports = router;
