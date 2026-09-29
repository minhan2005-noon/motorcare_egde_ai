const express = require('express');
const deviceController = require('../bo_dieu_khien/thiet_bi.bo_dieu_khien');

const router = express.Router();

router.post('/readings', deviceController.ingestReading);

module.exports = router;

