const crypto = require('crypto');
const motorRepository = require('../kho_du_lieu/dong_co.kho_du_lieu');
const sensorService = require('./cam_bien.dich_vu');
const httpError = require('../tien_ich/loi_http');

function unauthorized() {
  return httpError(401, 'Thông tin xác thực thiết bị không hợp lệ');
}

function readToken(headers = {}) {
  const bearer = String(headers.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1];
  return String(headers['x-device-token'] || bearer || '').trim();
}

function hashesMatch(token, expectedHash) {
  if (!token || !expectedHash) return false;
  const actual = crypto.createHash('sha256').update(token).digest();
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function normalizePayload(payload = {}) {
  const currentMa = payload.current_ma ?? payload.currentMa;
  return {
    recordedAt: payload.recordedAt,
    vibrationRms: payload.vibrationRms,
    currentRms: payload.currentRms ?? (
      currentMa === undefined || currentMa === null ? undefined : Number(currentMa) / 1000
    ),
    temperature: payload.temperature,
    soundLevel: payload.soundLevel,
    rpm: payload.rpm,
    accelerationRmsG: payload.accelerationRmsG ?? payload.vibration_rms_g,
    voltageV: payload.voltageV ?? payload.voltage_v,
    faultState: payload.faultState ?? payload.state,
    jamProbability: payload.jamProbability ?? payload.jam_probability,
    vibrationProbability: payload.vibrationProbability ?? payload.vibration_probability,
    sagProbability: payload.sagProbability ?? payload.sag_probability,
    uptimeMs: payload.uptimeMs ?? payload.uptime_ms,
    source: 'device',
  };
}

async function ingestReading(headers, payload) {
  const deviceCode = String(headers['x-device-code'] || payload?.deviceCode || '').trim();
  const credentials = deviceCode
    ? await motorRepository.findDeviceCredentials(deviceCode)
    : null;

  if (!credentials || !hashesMatch(readToken(headers), credentials.deviceTokenHash)) {
    throw unauthorized();
  }

  const reading = await sensorService.createDeviceReading(
    credentials.motor,
    normalizePayload(payload),
  );

  return {
    motorId: credentials.motor.id,
    deviceCode: credentials.motor.deviceCode,
    reading,
  };
}

module.exports = {
  ingestReading,
};

