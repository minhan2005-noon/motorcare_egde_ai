const userService = require('../dich_vu/nguoi_dung.dich_vu');
const asyncHandler = require('../tien_ich/xu_ly_bat_dong_bo');
const response = require('../tien_ich/phan_hoi_api');

const updateProfile = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user.id, req.body || {});
  return response.ok(res, { user }, 'Cập nhật hồ sơ thành công');
});

const getSettings = asyncHandler(async (req, res) => {
  const settings = await userService.getSettings(req.user.id);
  return response.ok(res, { settings }, 'Lấy cài đặt thành công');
});

const updateSettings = asyncHandler(async (req, res) => {
  const settings = await userService.updateSettings(req.user.id, req.body || {});
  return response.ok(res, { settings }, 'Cập nhật cài đặt thành công');
});

module.exports = {
  updateProfile,
  getSettings,
  updateSettings,
};
