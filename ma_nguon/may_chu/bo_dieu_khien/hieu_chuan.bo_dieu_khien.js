const calibrationService = require('../dich_vu/hieu_chuan.dich_vu');
const asyncHandler = require('../tien_ich/xu_ly_bat_dong_bo');
const response = require('../tien_ich/phan_hoi_api');

const list = asyncHandler(async (req, res) => {
  const calibrations = await calibrationService.listCalibrations(
    req.user.id,
    req.params.motorId,
  );
  return response.ok(res, { calibrations }, 'Lấy lịch sử hiệu chuẩn thành công');
});

const create = asyncHandler(async (req, res) => {
  const calibration = await calibrationService.createCalibration(
    req.user.id,
    req.params.motorId,
    req.body || {},
  );
  return response.created(res, { calibration }, 'Hiệu chuẩn thành công');
});

module.exports = {
  list,
  create,
};
