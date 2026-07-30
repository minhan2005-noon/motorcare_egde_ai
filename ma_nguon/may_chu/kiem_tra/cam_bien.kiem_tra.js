const httpError = require('../tien_ich/loi_http');

const ranges = {
  vibrationRms: [0, 100],
  currentRms: [0, 10000],
  temperature: [-50, 250],
  soundLevel: [0, 180],
  rpm: [0, 100000],
};

function numberOrNull(value, field) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const number = Number(value);
  const [min, max] = ranges[field];
  if (!Number.isFinite(number) || number < min || number > max) {
    throw httpError(400, `${field} nằm ngoài phạm vi cho phép`);
  }
  return number;
}

function reading(payload) {
  const recordedAt = payload.recordedAt
    ? new Date(payload.recordedAt)
    : new Date();

  if (Number.isNaN(recordedAt.getTime())) {
    throw httpError(400, 'Thời gian đo không hợp lệ');
  }
  if (recordedAt.getTime() > Date.now() + 5 * 60 * 1000) {
    throw httpError(400, 'Thời gian đo không được ở tương lai');
  }

  const result = {
    recordedAt: recordedAt.toISOString(),
    vibrationRms: numberOrNull(payload.vibrationRms, 'vibrationRms'),
    currentRms: numberOrNull(payload.currentRms, 'currentRms'),
    temperature: numberOrNull(payload.temperature, 'temperature'),
    soundLevel: numberOrNull(payload.soundLevel, 'soundLevel'),
    rpm: numberOrNull(payload.rpm, 'rpm'),
    source: ['device', 'manual', 'import'].includes(payload.source)
      ? payload.source
      : 'device',
  };

  if (Object.values(result).slice(1, 6).every((value) => value === null)) {
    throw httpError(400, 'Cần ít nhất một giá trị cảm biến');
  }

  return result;
}

module.exports = {
  reading,
};
