const sensorRepository = require('../kho_du_lieu/cam_bien.kho_du_lieu');
const alertRepository = require('../kho_du_lieu/canh_bao.kho_du_lieu');
const calibrationRepository = require('../kho_du_lieu/hieu_chuan.kho_du_lieu');
const motorRepository = require('../kho_du_lieu/dong_co.kho_du_lieu');
const motorService = require('./dong_co.dich_vu');
const sensorValidator = require('../kiem_tra/cam_bien.kiem_tra');

async function createThresholdAlert(motor, type, value, threshold, unit, severity = 'high') {
  if (await alertRepository.findRecentOpen(motor.id, type)) {
    return;
  }

  await alertRepository.create({
    motorId: motor.id,
    type,
    message: `${type}: ${value.toFixed(2)} ${unit}, vượt ngưỡng ${threshold.toFixed(2)} ${unit}`,
    severity,
    source: 'system',
  });
}

async function evaluateThresholds(motor, reading) {
  const calibration = await calibrationRepository.findLatest(motor.id);
  const thresholds = calibration?.thresholds || {
    vibrationWarning: 7.1,
    currentWarning: motor.ratedCurrent ? motor.ratedCurrent * 1.2 : 20,
    temperatureWarning: 80,
    soundWarning: 85,
  };

  const checks = [
    ['Rung động cao', reading.vibrationRms, thresholds.vibrationWarning, 'mm/s'],
    ['Dòng điện cao', reading.currentRms, thresholds.currentWarning, 'A'],
    ['Nhiệt độ cao', reading.temperature, thresholds.temperatureWarning, '°C'],
    ['Độ ồn cao', reading.soundLevel, thresholds.soundWarning, 'dB'],
  ];

  for (const [type, value, threshold, unit] of checks) {
    if (value !== null && threshold && value > threshold) {
      await createThresholdAlert(motor, type, value, threshold, unit);
    }
  }
}

async function createReading(userId, motorId, payload) {
  const motor = await motorService.getMotor(userId, motorId);
  const data = sensorValidator.reading(payload);
  const reading = await sensorRepository.create({
    motorId,
    ...data,
    createdAt: new Date().toISOString(),
  });

  await motorRepository.update(motorId, {
    connectionStatus: 'connected',
    lastSeenAt: data.recordedAt,
  });
  await evaluateThresholds(motor, reading);

  return reading;
}

async function listReadings(userId, motorId, options) {
  await motorService.getMotor(userId, motorId);
  const readings = await sensorRepository.findByMotor(motorId, options);
  const total = await sensorRepository.countByMotor(motorId);
  return { readings, total };
}

async function latestReading(userId, motorId) {
  await motorService.getMotor(userId, motorId);
  return sensorRepository.findLatest(motorId);
}

async function exportReadings(userId, motorId, options) {
  const motor = await motorService.getMotor(userId, motorId);
  const readings = await sensorRepository.findByMotor(motorId, {
    ...options,
    limit: 1000,
  });
  return { motor, readings };
}

module.exports = {
  createReading,
  listReadings,
  latestReading,
  exportReadings,
};
