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
    source: 'manual',
  });
  const stored = await sensorService.listReadings(registration.user.id, motor.id, {
    limit: 10,
  });
  const alertResult = await alertService.listAlerts(registration.user.id, {
    motorId: motor.id,
  });

  assert.equal(stored.total, 1);
  assert.equal(stored.readings[0].id, reading.id);
  assert.equal(alertResult.alerts.length, 1);
  assert.equal(alertResult.alerts[0].type, 'Nhiệt độ cao');
  assert.equal(alertResult.alerts[0].source, 'system');
});
