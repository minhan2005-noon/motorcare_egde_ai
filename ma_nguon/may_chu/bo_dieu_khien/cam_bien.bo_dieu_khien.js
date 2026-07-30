const sensorService = require('../dich_vu/cam_bien.dich_vu');
const asyncHandler = require('../tien_ich/xu_ly_bat_dong_bo');
const response = require('../tien_ich/phan_hoi_api');

const list = asyncHandler(async (req, res) => {
  const result = await sensorService.listReadings(
    req.user.id,
    req.params.motorId,
    req.query,
  );
  return response.ok(res, result, 'Lấy dữ liệu cảm biến thành công');
});

const create = asyncHandler(async (req, res) => {
  const reading = await sensorService.createReading(
    req.user.id,
    req.params.motorId,
    req.validated || req.body || {},
  );
  return response.created(res, { reading }, 'Ghi nhận dữ liệu cảm biến thành công');
});

const latest = asyncHandler(async (req, res) => {
  const reading = await sensorService.latestReading(req.user.id, req.params.motorId);
  return response.ok(res, { reading }, 'Lấy dữ liệu mới nhất thành công');
});

function csvCell(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const text = String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

const exportCsv = asyncHandler(async (req, res) => {
  const { motor, readings } = await sensorService.exportReadings(
    req.user.id,
    req.params.motorId,
    req.query,
  );
  const headers = [
    'recorded_at',
    'vibration_rms_mm_s',
    'current_rms_a',
    'temperature_c',
    'sound_level_db',
    'rpm',
    'source',
  ];
  const rows = readings.map((reading) => [
    reading.recordedAt,
    reading.vibrationRms,
    reading.currentRms,
    reading.temperature,
    reading.soundLevel,
    reading.rpm,
    reading.source,
  ].map(csvCell).join(','));

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${motor.deviceCode}-sensor-data.csv"`,
  );
  return res.send(`\uFEFF${headers.join(',')}\n${rows.join('\n')}`);
});

module.exports = {
  list,
  create,
  latest,
  exportCsv,
};
