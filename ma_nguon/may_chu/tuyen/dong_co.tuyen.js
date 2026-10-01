const express = require('express');
const motorController = require('../bo_dieu_khien/dong_co.bo_dieu_khien');
const { requireAuth } = require('../trung_gian/xac_thuc.trung_gian');

const router = express.Router();

router.use(requireAuth);

router.get('/', motorController.list);
router.post('/', motorController.create);
router.get('/:id', motorController.getById);
router.patch('/:id', motorController.update);
router.patch('/:id/connection', motorController.setConnection);
router.post('/:id/device-token', motorController.createDeviceToken);
router.post('/:id/public-view-token', motorController.createPublicViewToken);
router.delete('/:id', motorController.remove);

module.exports = router;
