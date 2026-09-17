const express = require('express');
const crypto = require('crypto');
const path = require('path');
const routes = require('./tuyen/chi_muc.tuyen');
const notFound = require('./trung_gian/khong_tim_thay.trung_gian');
const errorMiddleware = require('./trung_gian/loi.trung_gian');
const timeoutMiddleware = require('./trung_gian/het_thoi_gian.trung_gian');
const securityMiddleware = require('./trung_gian/bao_mat.trung_gian');
const corsMiddleware = require('./cau_hinh/cors.cau_hinh');
const appConfig = require('./cau_hinh/ung_dung.cau_hinh');
const {
  loadAuth,
  requirePageAuth,
  redirectIfAuthenticated,
} = require('./trung_gian/xac_thuc.trung_gian');

const app = express();
const webRoot = appConfig.webRoot;

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.locals.requestId = req.get('x-request-id') || crypto.randomUUID();
  res.setHeader('X-Request-Id', res.locals.requestId);
  next();
});

app.use(securityMiddleware);
app.use(corsMiddleware);
app.use(timeoutMiddleware());
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));
app.use('/css', express.static(path.join(webRoot, 'kieu_dang'), { index: false }));
app.use('/js', express.static(path.join(webRoot, 'ma_javascript'), { index: false }));
app.get('/vendor/three.module.min.js', (req, res) => {
  res.sendFile(path.join(appConfig.projectRoot, 'node_modules/three/build/three.module.min.js'));
});
app.get('/vendor/three.core.min.js', (req, res) => {
  res.sendFile(path.join(appConfig.projectRoot, 'node_modules/three/build/three.core.min.js'));
});
app.get('/favicon.ico', (req, res) => res.sendStatus(204));
app.use(loadAuth);

app.use('/api', routes);

function sendPage(filename) {
  return (req, res) => res.sendFile(path.join(webRoot, 'trang', filename));
}

app.get('/', (req, res) => {
  res.redirect(req.user ? '/dashboard' : '/login');
});

app.get('/login', redirectIfAuthenticated, sendPage('dang_nhap.html'));
app.get('/register', redirectIfAuthenticated, sendPage('dang_ky.html'));
app.get('/forgot-password', redirectIfAuthenticated, sendPage('quen_mat_khau.html'));

app.get('/dashboard', requirePageAuth, (req, res) => {
  res.sendFile(path.join(webRoot, 'trang/bang_dieu_khien.html'));
});
app.get('/motors', requirePageAuth, sendPage('dong_co.html'));
app.get('/motors/:id', requirePageAuth, sendPage('chi_tiet_dong_co.html'));
app.get('/alerts', requirePageAuth, sendPage('canh_bao.html'));
app.get('/dataset', requirePageAuth, sendPage('du_lieu.html'));
app.get('/calibration', requirePageAuth, sendPage('hieu_chuan.html'));
app.get('/profile', requirePageAuth, sendPage('ho_so.html'));
app.get('/settings', requirePageAuth, sendPage('cai_dat.html'));

app.use(notFound);
app.use(errorMiddleware);

module.exports = app;
