const dashboardService = require('../dich_vu/bang_dieu_khien.dich_vu');
const asyncHandler = require('../tien_ich/xu_ly_bat_dong_bo');
const response = require('../tien_ich/phan_hoi_api');

const overview = asyncHandler(async (req, res) => {
  const overviewData = await dashboardService.getOverview(req.user.id, req.query.motorId);
  return response.ok(res, overviewData, 'Lấy dữ liệu dashboard thành công');
});

module.exports = {
  overview,
};
