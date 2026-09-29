const express = require('express');
const authRoutes = require('./xac_thuc.tuyen');
const motorRoutes = require('./dong_co.tuyen');
const dashboardRoutes = require('./bang_dieu_khien.tuyen');
const sensorRoutes = require('./cam_bien.tuyen');
const alertRoutes = require('./canh_bao.tuyen');
const calibrationRoutes = require('./hieu_chuan.tuyen');
const userRoutes = require('./nguoi_dung.tuyen');
const deviceRoutes = require('./thiet_bi.tuyen');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'MotorCare Edge AI API is running',
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

router.use('/auth', authRoutes);
router.use('/devices', deviceRoutes);
router.use('/motors', motorRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/sensors', sensorRoutes);
router.use('/alerts', alertRoutes);
router.use('/calibrations', calibrationRoutes);
router.use('/users', userRoutes);

module.exports = router;
