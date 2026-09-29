const test = require('node:test');
const assert = require('node:assert/strict');
const authService = require('../../may_chu/dich_vu/xac_thuc.dich_vu');
const motorService = require('../../may_chu/dich_vu/dong_co.dich_vu');
const dashboardService = require('../../may_chu/dich_vu/bang_dieu_khien.dich_vu');
const alertRepository = require('../../may_chu/kho_du_lieu/canh_bao.kho_du_lieu');

async function createUser() {
  const result = await authService.register({
    email: `motor-${Date.now()}-${Math.random()}@example.com`,
    name: 'Motor Owner',
    password: 'Secret123!',
  });

  return result.user;
}

test('motor service creates and lists motors by owner', async () => {
  const user = await createUser();

  const motor = await motorService.createMotor(user.id, {
    name: 'Pump A',
    location: 'Line 1',
    model: 'MX-100',
    serialNumber: 'SN-001',
  });

  const motors = await motorService.listMotors(user.id);

  assert.equal(motor.name, 'Pump A');
  assert.equal(motor.status, 'active');
  assert.equal(motors.length, 1);
  assert.equal(motors[0].id, motor.id);
});

test('motor service updates status and enforces ownership', async () => {
  const owner = await createUser();
  const otherUser = await createUser();

  const motor = await motorService.createMotor(owner.id, {
    name: 'Fan B',
  });

  const updated = await motorService.updateMotor(owner.id, motor.id, {
    status: 'maintenance',
  });

  assert.equal(updated.status, 'maintenance');

  await assert.rejects(
    () => motorService.getMotor(otherUser.id, motor.id),
    /Không tìm thấy motor/,
  );
  await assert.rejects(
    () => motorService.setConnection(owner.id, motor.id, true),
    /chỉ được đánh dấu trực tuyến/,
  );
});

test('dashboard health includes every active alert, not only the five displayed', async () => {
  const owner = await createUser();
  const motor = await motorService.createMotor(owner.id, { name: 'Health Motor' });
  for (let index = 0; index < 6; index += 1) {
    await alertRepository.create({
      motorId: motor.id,
      type: `Cảnh báo ${index}`,
      message: 'Kiểm thử điểm sức khỏe',
      severity: 'medium',
    });
  }
  const overview = await dashboardService.getOverview(owner.id, motor.id);
  assert.equal(overview.alerts.length, 5);
  assert.equal(overview.health.score, 52);
});

test('deleting the selected motor returns a replacement and dashboard falls back', async () => {
  const owner = await createUser();
  const firstMotor = await motorService.createMotor(owner.id, {
    name: 'Delete Me',
  });
  const remainingMotor = await motorService.createMotor(owner.id, {
    name: 'Keep Me',
  });

  const deletion = await motorService.deleteMotor(owner.id, firstMotor.id);
  const overview = await dashboardService.getOverview(owner.id, firstMotor.id);

  assert.equal(deletion.deletedMotorId, firstMotor.id);
  assert.equal(deletion.remainingCount, 1);
  assert.equal(deletion.nextMotorId, remainingMotor.id);
  assert.equal(overview.motors.length, 1);
  assert.equal(overview.selectedMotor.id, remainingMotor.id);
  await assert.rejects(
    () => motorService.getMotor(owner.id, firstMotor.id),
    /Không tìm thấy motor/,
  );
});
