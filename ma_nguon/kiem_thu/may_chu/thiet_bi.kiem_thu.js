const test = require('node:test');
const assert = require('node:assert/strict');
const authService = require('../../may_chu/dich_vu/xac_thuc.dich_vu');
const motorService = require('../../may_chu/dich_vu/dong_co.dich_vu');
const deviceService = require('../../may_chu/dich_vu/thiet_bi.dich_vu');
const sensorService = require('../../may_chu/dich_vu/cam_bien.dich_vu');

test('real device token authenticates and persists an embedded sensor reading', async () => {
  const registration = await authService.register({
    email: `device-${Date.now()}@example.com`,
    name: 'Device Test',
    password: 'Secret123!',
  });
  const motor = await motorService.createMotor(registration.user.id, {
    name: 'ESP32 Test Motor',
    deviceCode: `ESP32-${Date.now()}`,
  });
  const setup = await motorService.createDeviceToken(registration.user.id, motor.id);

  await assert.rejects(
    () => deviceService.ingestReading({
      'x-device-code': setup.deviceCode,
      'x-device-token': 'invalid-token',
    }, { voltage_v: 12, current_ma: 420, vibration_rms_g: 0.08 }),
    /xác thực thiết bị không hợp lệ/,
  );

  const result = await deviceService.ingestReading({
    'x-device-code': setup.deviceCode,
    'x-device-token': setup.token,
  }, {
    state: 'normal',
    voltage_v: 12.15,
    current_ma: 420,
    vibration_rms_g: 0.08,
    jam_probability: 0.04,
    vibration_probability: 0.12,
    sag_probability: 0.02,
    uptime_ms: 5000,
  });

  const latest = await sensorService.latestReading(registration.user.id, motor.id);
  const connectedMotor = await motorService.getMotor(registration.user.id, motor.id);

  assert.equal(result.deviceCode, setup.deviceCode);
  assert.equal(latest.currentRms, 0.42);
  assert.equal(latest.voltageV, 12.15);
  assert.equal(latest.accelerationRmsG, 0.08);
  assert.equal(latest.faultState, 'normal');
  assert.equal(connectedMotor.connectionStatus, 'connected');
  assert.ok(connectedMotor.lastSeenAt);
});

