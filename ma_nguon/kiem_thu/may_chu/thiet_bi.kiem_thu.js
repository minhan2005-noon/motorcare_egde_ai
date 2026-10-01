const test = require('node:test');
const assert = require('node:assert/strict');
const authService = require('../../may_chu/dich_vu/xac_thuc.dich_vu');
const motorService = require('../../may_chu/dich_vu/dong_co.dich_vu');
const deviceService = require('../../may_chu/dich_vu/thiet_bi.dich_vu');
const sensorService = require('../../may_chu/dich_vu/cam_bien.dich_vu');
const alertService = require('../../may_chu/dich_vu/canh_bao.dich_vu');
const dashboardService = require('../../may_chu/dich_vu/bang_dieu_khien.dich_vu');

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
  const publicView = await motorService.createPublicViewToken(registration.user.id, motor.id);

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

  await deviceService.ingestReading({
    'x-device-code': setup.deviceCode,
    'x-device-token': setup.token,
  }, {
    state: 'jam',
    voltage_v: 12.05,
    current_ma: 860,
    vibration_rms_g: 0.11,
    jam_probability: 0.91,
    vibration_probability: 0.18,
    sag_probability: 0.06,
    uptime_ms: 6000,
  });

  const alerts = await alertService.listAlerts(registration.user.id, { motorId: motor.id });
  const overview = await dashboardService.getOverview(registration.user.id, motor.id);

  assert.equal(alerts.alerts.length, 1);
  assert.equal(alerts.alerts[0].type, 'AI · Kẹt tải');
  assert.equal(alerts.alerts[0].source, 'ai');
  assert.equal(alerts.alerts[0].severity, 'critical');
  assert.equal(alerts.alerts[0].confidence, 0.91);
  assert.equal(overview.diagnosis.available, true);
  assert.equal(overview.diagnosis.level, 'danger');
  assert.equal(overview.diagnosis.state, 'jam');
  assert.equal(overview.diagnosis.outcomes[0].probability, 0.91);

  const publicOverview = await dashboardService.getPublicOverview(publicView.token);
  assert.equal(publicOverview.selectedMotor.id, motor.id);
  assert.equal(publicOverview.selectedMotor.name, motor.name);
  assert.equal(publicOverview.motors.length, 1);
  assert.equal(publicOverview.connection.status, 'connected');
  assert.equal(publicOverview.diagnosis.state, 'jam');
  assert.equal('ownerId' in publicOverview.selectedMotor, false);

  const replacementView = await motorService.createPublicViewToken(registration.user.id, motor.id);
  await assert.rejects(
    () => dashboardService.getPublicOverview(publicView.token),
    /không hợp lệ hoặc đã hết hiệu lực/,
  );
  assert.equal(
    (await dashboardService.getPublicOverview(replacementView.token)).selectedMotor.id,
    motor.id,
  );
});
