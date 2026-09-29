const sensorRepository = require('../kho_du_lieu/cam_bien.kho_du_lieu');
const alertRepository = require('../kho_du_lieu/canh_bao.kho_du_lieu');
const calibrationRepository = require('../kho_du_lieu/hieu_chuan.kho_du_lieu');
const motorRepository = require('../kho_du_lieu/dong_co.kho_du_lieu');
const motorService = require('./dong_co.dich_vu');
const sensorValidator = require('../kiem_tra/cam_bien.kiem_tra');
const httpError = require('../tien_ich/loi_http');

function normalizeOptions(options = {}) {
  const normalized = {
    limit: options.limit,
    offset: options.offset,
  };
  for (const field of ['from', 'to']) {
    if (!options[field]) continue;
    const date = new Date(options[field]);
    if (Number.isNaN(date.getTime())) {
      throw httpError(400, `Thời gian ${field} không hợp lệ`);
    }
    normalized[field] = date.toISOString();
  }
  if (normalized.from && normalized.to && normalized.from > normalized.to) {
    throw httpError(400, 'Thời gian bắt đầu phải trước thời gian kết thúc');
  }
  return normalized;
}

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

const aiFaults = [
  { key: 'jamProbability', type: 'AI · Kẹt tải', label: 'kẹt tải' },
  { key: 'vibrationProbability', type: 'AI · Rung bất thường', label: 'rung bất thường' },
  { key: 'sagProbability', type: 'AI · Sụt áp', label: 'sụt áp' },
];

function aiSeverity(probability) {
  if (probability >= 0.85) return 'critical';
  if (probability >= 0.7) return 'high';
  return 'medium';
}

async function evaluateEmbeddedAi(motor, reading) {
  const configuredThreshold = Number(process.env.AI_ALERT_THRESHOLD);
  const threshold = Number.isFinite(configuredThreshold)
    ? Math.min(Math.max(configuredThreshold, 0.5), 0.95)
    : 0.5;

  for (const fault of aiFaults) {
    const probability = reading[fault.key];
    if (!Number.isFinite(probability) || probability < threshold) continue;
    if (await alertRepository.findRecentOpen(motor.id, fault.type)) continue;

    await alertRepository.create({
      motorId: motor.id,
      type: fault.type,
      message: `Edge AI phát hiện nguy cơ ${fault.label} với độ tin cậy ${(probability * 100).toFixed(1)}%`,
      severity: aiSeverity(probability),
      confidence: probability,
      source: 'ai',
    });
  }
}

async function persistReading(motor, payload) {
  const data = sensorValidator.reading(payload);
  const receivedAt = new Date().toISOString();
  const reading = await sensorRepository.create({
    motorId: motor.id,
    ...data,
    createdAt: receivedAt,
  });

  if (data.source === 'device') {
    await motorRepository.update(motor.id, {
      connectionStatus: 'connected',
      lastSeenAt: receivedAt,
    });
  }
  await evaluateThresholds(motor, reading);
  await evaluateEmbeddedAi(motor, reading);

  return reading;
}

async function createReading(userId, motorId, payload) {
  const motor = await motorService.getMotor(userId, motorId);
  return persistReading(motor, {
    ...payload,
    source: 'manual',
  });
}

async function createDeviceReading(motor, payload) {
  return persistReading(motor, {
    ...payload,
    source: 'device',
  });
}

async function listReadings(userId, motorId, options) {
  await motorService.getMotor(userId, motorId);
  const normalized = normalizeOptions(options);
  const [readings, total] = await Promise.all([
    sensorRepository.findByMotor(motorId, normalized),
    sensorRepository.countByMotor(motorId, normalized),
  ]);
  return { readings, total };
}

async function latestReading(userId, motorId) {
  await motorService.getMotor(userId, motorId);
  return sensorRepository.findLatest(motorId);
}

async function exportReadings(userId, motorId, options) {
  const motor = await motorService.getMotor(userId, motorId);
  const normalized = normalizeOptions(options);
  const readings = await sensorRepository.findByMotor(motorId, {
    ...normalized,
    limit: 1000,
  });
  return { motor, readings };
}

module.exports = {
  createReading,
  createDeviceReading,
  listReadings,
  latestReading,
  exportReadings,
  normalizeOptions,
};
