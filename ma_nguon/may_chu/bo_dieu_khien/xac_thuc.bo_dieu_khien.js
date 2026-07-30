const authService = require('../dich_vu/xac_thuc.dich_vu');
const asyncHandler = require('../tien_ich/xu_ly_bat_dong_bo');
const response = require('../tien_ich/phan_hoi_api');
const { sessionCookie, expiredSessionCookie } = require('../tien_ich/cookie');

function requestContext(req) {
  return {
    ipAddress: req.ip,
    userAgent: String(req.get('user-agent') || '').slice(0, 300),
  };
}

function sendAuthenticated(res, result, message, status = 200, req) {
  res.setHeader('Set-Cookie', sessionCookie(result.token, result.expiresAt));
  const data = {
    user: result.user,
    session: { expiresAt: result.expiresAt },
  };

  if (req.get('x-auth-transport') === 'bearer') {
    data.token = result.token;
  }

  return response.ok(res, data, message, status);
}

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.validated || req.body || {}, requestContext(req));
  return sendAuthenticated(res, result, 'Đăng ký thành công', 201, req);
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.validated || req.body || {}, requestContext(req));
  return sendAuthenticated(res, result, 'Đăng nhập thành công', 200, req);
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user.id);
  return response.ok(res, { user }, 'Lấy thông tin người dùng thành công');
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.authToken);
  res.setHeader('Set-Cookie', expiredSessionCookie());
  return response.ok(res, null, 'Đăng xuất thành công');
});

const logoutAll = asyncHandler(async (req, res) => {
  await authService.logoutAll(req.user.id);
  res.setHeader('Set-Cookie', expiredSessionCookie());
  return response.ok(res, null, 'Đã đăng xuất khỏi tất cả thiết bị');
});

const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.validated || req.body || {});
  return response.ok(res, result, result.message);
});

const verifyResetCode = asyncHandler(async (req, res) => {
  const result = await authService.verifyResetCode(req.validated || req.body || {});
  return response.ok(res, result, 'Mã xác minh hợp lệ');
});

const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.validated || req.body || {});
  res.setHeader('Set-Cookie', expiredSessionCookie());
  return response.ok(res, null, 'Đặt lại mật khẩu thành công');
});

const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user.id, req.validated || req.body || {});
  res.setHeader('Set-Cookie', expiredSessionCookie());
  return response.ok(res, null, 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại');
});

module.exports = {
  register,
  login,
  me,
  logout,
  logoutAll,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  changePassword,
};
