const motorRepository = require('../kho_du_lieu/dong_co.kho_du_lieu');
const sensorRepository = require('../kho_du_lieu/cam_bien.kho_du_lieu');
const alertRepository = require('../kho_du_lieu/canh_bao.kho_du_lieu');

function round(value, digits = 2) {
  return value === null || value === undefined ? null : Number(value.toFixed(digits));
}

function metric(id, label, unit, color, values, key) {
  const latest = values.at(-1)?.[key] ?? null;
  const first = values[0]?.[key] ?? latest;
  const change = first && latest !== null ? ((latest - first) / first) * 100 : 0;
  return {
    id,
    label,
    unit,
    color,
    value: round(latest),
    change: round(change, 1),
    values: values.map((row) => row[key]).filter((value) => value !== null),
  };
}

function isDeviceOnline(motor) {
  if (motor.connectionStatus !== 'connected' || !motor.lastSeenAt) return false;
  const offlineAfterMs = Math.max(Number(process.env.DEVICE_OFFLINE_SECONDS) || 90, 10) * 1000;
  return Date.now() - new Date(motor.lastSeenAt).getTime() <= offlineAfterMs;
}

function healthFrom(alerts, latest) {
  const penalties = { low: 3, medium: 8, high: 16, critical: 28 };
  let score = 100;
  alerts.filter((alert) => alert.status !== 'resolved').forEach((alert) => {
    score -= penalties[alert.severity] || 0;
  });
  if (latest?.temperature > 80) score -= 12;
  if (latest?.vibrationRms > 7.1) score -= 12;
  score = Math.max(0, Math.min(100, score));

  let status = 'Tốt';
  if (score < 50) status = 'Nguy hiểm';
  else if (score < 75) status = 'Cần kiểm tra';
  else if (score < 90) status = 'Ổn định';

  return { score, status };
}

async function getOverview(userId, requestedMotorId) {
  const motors = await motorRepository.findAllByOwner(userId);
  const selectedMotor = requestedMotorId
    ? motors.find((motor) => motor.id === requestedMotorId) || motors[0] || null
    : motors[0] || null;

  if (!selectedMotor) {
    return {
      motors: [],
      selectedMotor: null,
      connection: { status: 'disconnected', deviceId: 'Chưa có thiết bị', lastUpdated: null },
      health: { score: 0, status: 'Chưa có dữ liệu' },
      metrics: [],
      charts: { labels: [], vibration: [], current: [], temperature: [] },
      diagnosis: { available: false, message: 'Mô-đun AI chưa được tích hợp' },
      alerts: [],
      openAlertCount: 0,
    };
  }

  const [series, alerts, openAlertCount] = await Promise.all([
    sensorRepository.findSeries(selectedMotor.id, 30),
    alertRepository.findByOwner(userId, { motorId: selectedMotor.id, limit: 5 }),
    alertRepository.countOpenByOwner(userId),
  ]);
  const latest = series.at(-1) || null;
  const usesEmbeddedReadings = latest?.accelerationRmsG !== null
    && latest?.accelerationRmsG !== undefined;
  const online = isDeviceOnline(selectedMotor);
  const labels = series.map((row) => new Date(row.recordedAt).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }));

  return {
    motors,
    selectedMotor,
    connection: {
      status: online ? 'connected' : 'disconnected',
      deviceId: selectedMotor.deviceCode,
      lastUpdated: selectedMotor.lastSeenAt,
    },
    health: healthFrom(alerts, latest),
    metrics: [
      metric(
        'vibration',
        usesEmbeddedReadings ? 'Gia tốc rung RMS' : 'Vibration RMS',
        usesEmbeddedReadings ? 'g' : 'mm/s',
        '#1d6ef2',
        series,
        usesEmbeddedReadings ? 'accelerationRmsG' : 'vibrationRms',
      ),
      metric('current', 'Current RMS', 'A', '#12a764', series, 'currentRms'),
      metric('temperature', 'Temperature', '°C', '#f47a24', series, 'temperature'),
      usesEmbeddedReadings
        ? metric('voltage', 'Điện áp', 'V', '#7c5ce7', series, 'voltageV')
        : metric('sound', 'Sound Level', 'dB', '#7c5ce7', series, 'soundLevel'),
    ],
    charts: {
      labels,
      vibration: series.map((row) => (
        usesEmbeddedReadings ? row.accelerationRmsG : row.vibrationRms
      )),
      current: series.map((row) => row.currentRms),
      temperature: series.map((row) => row.temperature),
      vibrationLabel: usesEmbeddedReadings ? 'Gia tốc rung RMS' : 'Độ rung RMS',
      vibrationUnit: usesEmbeddedReadings ? 'g' : 'mm/s',
    },
    diagnosis: {
      available: false,
      message: 'Mô-đun AI đang chờ nhóm phụ trách tích hợp',
      integrationEndpoint: '/api/ai/inference',
    },
    alerts,
    openAlertCount,
  };
}

module.exports = {
  getOverview,
};
