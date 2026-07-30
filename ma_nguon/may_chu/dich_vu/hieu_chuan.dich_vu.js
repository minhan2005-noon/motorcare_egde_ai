const crypto = require('crypto');
const calibrationRepository = require('../kho_du_lieu/hieu_chuan.kho_du_lieu');
const sensorRepository = require('../kho_du_lieu/cam_bien.kho_du_lieu');
const motorService = require('./dong_co.dich_vu');
const httpError = require('../tien_ich/loi_http');

function round(value) {
  return value === null || value === undefined ? null : Number(value.toFixed(3));
}

async function listCalibrations(userId, motorId) {
  await motorService.getMotor(userId, motorId);
  return calibrationRepository.findByMotor(motorId);
}

async function createCalibration(userId, motorId, payload = {}) {
  await motorService.getMotor(userId, motorId);
  const sampleCount = Math.min(Math.max(Number(payload.sampleCount) || 30, 5), 500);
  const averages = await sensorRepository.averages(motorId, sampleCount);

  if (!averages.sample_count) {
    throw httpError(400, 'Motor chưa có dữ liệu cảm biến để hiệu chuẩn');
  }

  const baselines = {
    vibrationBaseline: round(averages.vibration_baseline),
    currentBaseline: round(averages.current_baseline),
    temperatureBaseline: round(averages.temperature_baseline),
    soundBaseline: round(averages.sound_baseline),
  };
  const thresholds = {
    vibrationWarning: Number(payload.vibrationWarning)
      || round((baselines.vibrationBaseline || 4.7) * 1.5),
    currentWarning: Number(payload.currentWarning)
      || round((baselines.currentBaseline || 13.3) * 1.5),
    temperatureWarning: Number(payload.temperatureWarning)
      || round((baselines.temperatureBaseline || 65) + 15),
    soundWarning: Number(payload.soundWarning)
      || round((baselines.soundBaseline || 56.7) + 15),
  };

  for (const value of Object.values(thresholds)) {
    if (!Number.isFinite(value) || value <= 0) {
      throw httpError(400, 'Ngưỡng cảnh báo phải là số dương');
    }
  }

  return calibrationRepository.create({
    id: crypto.randomUUID(),
    motorId,
    createdBy: userId,
    sampleCount: averages.sample_count,
    ...baselines,
    thresholds,
    notes: String(payload.notes || '').trim().slice(0, 500),
    createdAt: new Date().toISOString(),
  });
}

module.exports = {
  listCalibrations,
  createCalibration,
};
