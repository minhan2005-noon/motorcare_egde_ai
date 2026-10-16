const express = require('express');
const crypto = require('crypto');
const path = require('path');
const routes = require('./tuyen/chi_muc.tuyen');
const notFound = require('./trung_gian/khong_tim_thay.trung_gian');
const errorMiddleware = require('./trung_gian/loi.trung_gian');
const securityMiddleware = require('./trung_gian/bao_mat.trung_gian');
const auditMiddleware = require('./trung_gian/nhat_ky.trung_gian');
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
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));
app.use('/css', express.static(path.join(webRoot, 'kieu_dang'), { index: false }));
app.use('/js', express.static(path.join(webRoot, 'ma_javascript'), { index: false }));
app.get('/favicon.ico', (req, res) => res.sendStatus(204));
app.use(loadAuth);
app.use('/api', (req, res, next) => {
  // Authenticated/device state must always come from the shared database.
  // Explicitly prevent browsers and intermediary CDNs from serving one
  // client's stale motor state to another request.
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Pragma', 'no-cache');
  next();
});
app.use('/api', auditMiddleware);

app.use('/api', routes);

function sendPage(filename) {
  return (req, res) => res.sendFile(path.join(webRoot, 'trang', filename));
}

// Luon bat dau tu man hinh dang nhap khi nguoi dung mo lien ket ung dung.
// Phien hien tai van duoc giu de cac trang nghiep vu khong bi dang xuat ngoai y muon.
app.get('/', (req, res) => {
  res.redirect('/login');
});

app.get('/login', sendPage('dang_nhap.html'));
app.get('/register', redirectIfAuthenticated, sendPage('dang_ky.html'));
app.get('/forgot-password', redirectIfAuthenticated, sendPage('quen_mat_khau.html'));
app.get('/view/:token', sendPage('xem_cong_khai.html'));

app.get('/dashboard', requirePageAuth, (req, res) => {
  res.sendFile(path.join(webRoot, 'trang/bang_dieu_khien.html'));
});
app.get('/motors', requirePageAuth, sendPage('dong_co.html'));
app.get('/motors/:id', requirePageAuth, sendPage('chi_tiet_dong_co.html'));
app.get('/alerts', requirePageAuth, sendPage('canh_bao.html'));
app.get('/dataset', requirePageAuth, sendPage('du_lieu.html'));
app.get('/calibration', requirePageAuth, sendPage('hieu_chuan.html'));
app.get('/settings', requirePageAuth, sendPage('cai_dat.html'));

app.use(notFound);
app.use(errorMiddleware);

module.exports = app;
