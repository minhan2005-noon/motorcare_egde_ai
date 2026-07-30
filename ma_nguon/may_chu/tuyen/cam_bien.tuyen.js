const express = require('express');
const sensorController = require('../bo_dieu_khien/cam_bien.bo_dieu_khien');
const { requireAuth } = require('../trung_gian/xac_thuc.trung_gian');
const validate = require('../trung_gian/kiem_tra.trung_gian');
const sensorValidator = require('../kiem_tra/cam_bien.kiem_tra');

const router = express.Router();

router.use(requireAuth);
router.get('/motors/:motorId/readings', sensorController.list);
router.post(
  '/motors/:motorId/readings',
  validate(sensorValidator.reading),
  sensorController.create,
);
router.get('/motors/:motorId/latest', sensorController.latest);
router.get('/motors/:motorId/export', sensorController.exportCsv);

module.exports = router;
