const alertService = require('../dich_vu/canh_bao.dich_vu');
const asyncHandler = require('../tien_ich/xu_ly_bat_dong_bo');
const response = require('../tien_ich/phan_hoi_api');

const list = asyncHandler(async (req, res) => {
  const result = await alertService.listAlerts(req.user.id, req.query);
  return response.ok(res, result, 'Lấy danh sách cảnh báo thành công');
});

const changeStatus = asyncHandler(async (req, res) => {
  const alert = await alertService.changeStatus(
    req.user.id,
    req.params.id,
    req.body?.status,
  );
  return response.ok(res, { alert }, 'Cập nhật cảnh báo thành công');
});

module.exports = {
  list,
  changeStatus,
};
