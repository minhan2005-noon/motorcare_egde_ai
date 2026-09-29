const os = require('os');
const appConfig = require('../cau_hinh/ung_dung.cau_hinh');
const motorService = require('../dich_vu/dong_co.dich_vu');
const asyncHandler = require('../tien_ich/xu_ly_bat_dong_bo');
const response = require('../tien_ich/phan_hoi_api');

const list = asyncHandler(async (req, res) => {
  const motors = await motorService.listMotors(req.user.id);
  return response.ok(res, { motors }, 'Lấy danh sách motor thành công');
});

const create = asyncHandler(async (req, res) => {
  const motor = await motorService.createMotor(req.user.id, req.body || {});
  return response.created(res, { motor }, 'Tạo motor thành công');
});

const getById = asyncHandler(async (req, res) => {
  const motor = await motorService.getMotor(req.user.id, req.params.id);
  return response.ok(res, { motor }, 'Lấy thông tin motor thành công');
});

const update = asyncHandler(async (req, res) => {
  const motor = await motorService.updateMotor(req.user.id, req.params.id, req.body || {});
  return response.ok(res, { motor }, 'Cập nhật motor thành công');
});

const remove = asyncHandler(async (req, res) => {
  const deletion = await motorService.deleteMotor(req.user.id, req.params.id);
  return response.ok(res, deletion, 'Xóa motor thành công');
});

const setConnection = asyncHandler(async (req, res) => {
  if (typeof req.body?.connected !== 'boolean') {
    const error = new Error('connected phải là kiểu boolean');
    error.status = 400;
    throw error;
  }
  const motor = await motorService.setConnection(
    req.user.id,
    req.params.id,
    req.body.connected,
  );
  return response.ok(res, { motor }, 'Cập nhật kết nối thành công');
});

const createDeviceToken = asyncHandler(async (req, res) => {
  const setup = await motorService.createDeviceToken(req.user.id, req.params.id);
  const host = req.get('host') || '';
  const isLocalHost = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
  let endpoint = appConfig.publicAppUrl
    ? `${appConfig.publicAppUrl}/api/devices/readings`
    : `${req.protocol}://${host}/api/devices/readings`;

  if (isLocalHost && !process.env.VERCEL) {
    const localAddress = Object.values(os.networkInterfaces())
      .flat()
      .find((item) => item && item.family === 'IPv4' && !item.internal)?.address;
    if (localAddress) {
      const port = host.split(':')[1] || '3000';
      endpoint = `http://${localAddress}:${port}/api/devices/readings`;
    }
  }

  return response.created(res, { setup: { ...setup, endpoint } }, 'Đã tạo mã kết nối thiết bị');
});

module.exports = {
  list,
  create,
  getById,
  update,
  remove,
  setConnection,
  createDeviceToken,
};
