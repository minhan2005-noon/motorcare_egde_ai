const test = require('node:test');
const assert = require('node:assert/strict');
const authService = require('../../may_chu/dich_vu/xac_thuc.dich_vu');
const motorService = require('../../may_chu/dich_vu/dong_co.dich_vu');
const sensorService = require('../../may_chu/dich_vu/cam_bien.dich_vu');
const alertService = require('../../may_chu/dich_vu/canh_bao.dich_vu');

test('sensor reading is persisted and creates a threshold alert', async () => {
  const registration = await authService.register({
    email: `sensor-${Date.now()}@example.com`,
    name: 'Sensor Test',
    password: 'Secret123!',
  });
  const motor = await motorService.createMotor(registration.user.id, {
    name: 'Temperature Test Motor',
    ratedCurrent: 10,
  });

  const reading = await sensorService.createReading(registration.user.id, motor.id, {
    vibrationRms: 2.2,
    currentRms: 5.5,
    temperature: 95,
    soundLevel: 54,
    source: 'device',
  });
  const stored = await sensorService.listReadings(registration.user.id, motor.id, {
    limit: 10,
  });
  const alertResult = await alertService.listAlerts(registration.user.id, {
    motorId: motor.id,
  });

  assert.equal(stored.total, 1);
  assert.equal(stored.readings[0].id, reading.id);
  assert.equal(stored.readings[0].source, 'manual');
  assert.equal(alertResult.alerts.length, 1);
  assert.equal(alertResult.alerts[0].type, 'Nhiệt độ cao');
  assert.equal(alertResult.alerts[0].source, 'system');
  assert.equal((await motorService.getMotor(registration.user.id, motor.id)).connectionStatus, 'disconnected');
});

test('sensor date filters apply to both rows and total count', async () => {
  const registration = await authService.register({
    email: `sensor-filter-${Date.now()}@example.com`,
    name: 'Sensor Filter Test',
    password: 'Secret123!',
  });
  const motor = await motorService.createMotor(registration.user.id, { name: 'Filter Motor' });
  for (const recordedAt of ['2026-01-01T10:00:00.000Z', '2026-01-02T10:00:00.000Z']) {
    await sensorService.createReading(registration.user.id, motor.id, {
      recordedAt,
      temperature: 40,
      source: 'manual',
    });
  }
  const result = await sensorService.listReadings(registration.user.id, motor.id, {
    from: '2026-01-02T00:00:00.000Z',
    to: '2026-01-02T23:59:59.999Z',
  });
  assert.equal(result.readings.length, 1);
  assert.equal(result.total, 1);
  assert.equal(result.readings[0].recordedAt, '2026-01-02T10:00:00.000Z');
});
