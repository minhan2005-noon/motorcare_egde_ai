const motorRepository = require('../kho_du_lieu/dong_co.kho_du_lieu');
const sensorRepository = require('../kho_du_lieu/cam_bien.kho_du_lieu');
const alertRepository = require('../kho_du_lieu/canh_bao.kho_du_lieu');
const calibrationRepository = require('../kho_du_lieu/hieu_chuan.kho_du_lieu');
const {
  isDeviceOnline,
  withEffectiveConnectionStatus,
} = require('../tien_ich/trang_thai_thiet_bi');
const { hashToken } = require('../tien_ich/ma_xac_thuc');
const httpError = require('../tien_ich/loi_http');

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

function healthFrom(activeAlertCounts, latest, thresholds = {}) {
  const penalties = { low: 3, medium: 8, high: 16, critical: 28 };
  let score = 100;
  Object.entries(activeAlertCounts).forEach(([severity, count]) => {
    score -= (penalties[severity] || 0) * Number(count || 0);
  });
  if (latest?.temperature > (thresholds.temperatureWarning || 80)) score -= 12;
  if (latest?.vibrationRms > (thresholds.vibrationWarning || 7.1)) score -= 12;
  score = Math.max(0, Math.min(100, score));

  let status = 'Tốt';
  if (score < 50) status = 'Nguy hiểm';
  else if (score < 75) status = 'Cần kiểm tra';
  else if (score < 90) status = 'Ổn định';

  return { score, status };
}

function aiDiagnosis(latest) {
  const outcomes = [
    { id: 'jam', label: 'Kẹt tải', probability: latest?.jamProbability },
    { id: 'vibration', label: 'Rung bất thường', probability: latest?.vibrationProbability },
    { id: 'sag', label: 'Sụt áp', probability: latest?.sagProbability },
  ].map((outcome) => ({
    ...outcome,
    probability: Number.isFinite(outcome.probability) ? outcome.probability : null,
  }));
  const available = outcomes.some((outcome) => outcome.probability !== null);

  if (!available) {
    return {
      available: false,
      level: 'waiting',
      state: 'waiting',
      message: 'Đang chờ kết quả Edge AI',
      description: 'Bật ESP32 đã ghép nối để gửi kết quả suy luận lên Dashboard.',
      confidence: null,
      outcomes,
      updatedAt: latest?.recordedAt || null,
    };
  }

  const active = outcomes.filter((outcome) => (
    outcome.probability !== null && outcome.probability >= 0.5
  ));
  const confidence = Math.max(...outcomes.map((outcome) => outcome.probability ?? 0));
  const level = confidence >= 0.85 ? 'danger' : active.length ? 'warning' : 'normal';

  return {
    available: true,
    level,
    state: active.length ? active.map((outcome) => outcome.id).join('+') : 'normal',
    message: active.length
      ? `Phát hiện ${active.map((outcome) => outcome.label.toLowerCase()).join(' + ')}`
      : 'Motor đang vận hành bình thường',
    description: active.length
      ? 'Kiểm tra thiết bị và đối chiếu dữ liệu cảm biến trước khi tiếp tục vận hành.'
      : 'Edge AI chưa phát hiện dấu hiệu kẹt tải, rung bất thường hoặc sụt áp.',
    confidence,
    outcomes,
    updatedAt: latest.recordedAt,
  };
}

async function getOverview(userId, requestedMotorId) {
  const storedMotors = await motorRepository.findAllByOwner(userId);
  const now = Date.now();
  const motors = storedMotors.map((motor) => withEffectiveConnectionStatus(motor, now));
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
      diagnosis: aiDiagnosis(null),
      alerts: [],
      openAlertCount: 0,
    };
  }

  const [series, alerts, openAlertCount, activeAlertCounts, calibration] = await Promise.all([
    sensorRepository.findSeries(selectedMotor.id, 30),
    alertRepository.findByOwner(userId, { motorId: selectedMotor.id, limit: 5 }),
    alertRepository.countOpenByOwner(userId),
    alertRepository.countActiveBySeverityForMotor(selectedMotor.id),
    calibrationRepository.findLatest(selectedMotor.id),
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
    health: healthFrom(activeAlertCounts, latest, calibration?.thresholds),
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
    diagnosis: aiDiagnosis(latest),
    alerts,
    openAlertCount,
  };
}

async function getPublicOverview(token) {
  const normalizedToken = String(token || '').trim();
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(normalizedToken)) {
    throw httpError(404, 'Liên kết xem không hợp lệ hoặc đã hết hiệu lực');
  }

  const motor = await motorRepository.findByPublicViewTokenHash(hashToken(normalizedToken));
  if (!motor) {
    throw httpError(404, 'Liên kết xem không hợp lệ hoặc đã hết hiệu lực');
  }

  const overview = await getOverview(motor.ownerId, motor.id);
  const publicMotor = overview.selectedMotor
    ? {
      id: overview.selectedMotor.id,
      name: overview.selectedMotor.name,
      connectionStatus: overview.connection.status,
      lastSeenAt: overview.connection.lastUpdated,
    }
    : null;

  return {
    ...overview,
    motors: publicMotor ? [publicMotor] : [],
    selectedMotor: publicMotor,
    connection: {
      ...overview.connection,
      deviceId: 'Thiết bị trung tâm',
    },
    openAlertCount: overview.alerts.filter((alert) => alert.status === 'open').length,
  };
}

module.exports = {
  getOverview,
  getPublicOverview,
};
