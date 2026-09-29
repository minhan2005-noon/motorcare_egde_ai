const deviceService = require('../dich_vu/thiet_bi.dich_vu');
const asyncHandler = require('../tien_ich/xu_ly_bat_dong_bo');
const response = require('../tien_ich/phan_hoi_api');

const ingestReading = asyncHandler(async (req, res) => {
  const result = await deviceService.ingestReading(req.headers, req.body || {});
  return response.created(res, result, 'Đã nhận dữ liệu cảm biến');
});

module.exports = {
  ingestReading,
};

