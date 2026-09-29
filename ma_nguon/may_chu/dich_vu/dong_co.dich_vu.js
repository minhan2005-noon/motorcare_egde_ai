const crypto = require('crypto');
const motorRepository = require('../kho_du_lieu/dong_co.kho_du_lieu');
const motorValidator = require('../kiem_tra/dong_co.kiem_tra');
const httpError = require('../tien_ich/loi_http');
const { withEffectiveConnectionStatus } = require('../tien_ich/trang_thai_thiet_bi');

async function createDeviceCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = `MC-EDGE-${crypto.randomInt(1000, 10000)}`;
    if (!(await motorRepository.findByDeviceCode(code))) {
      return code;
    }
  }
  return `MC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

async function listMotors(userId) {
  const motors = await motorRepository.findAllByOwner(userId);
  const now = Date.now();
  return motors.map((motor) => withEffectiveConnectionStatus(motor, now));
}

async function createMotor(userId, payload) {
  const data = motorValidator.create(payload);
  const deviceCode = data.deviceCode || await createDeviceCode();
  if (await motorRepository.findByDeviceCode(deviceCode)) {
    throw httpError(409, 'Mã thiết bị đã tồn tại');
  }

  const now = new Date().toISOString();
  return withEffectiveConnectionStatus(await motorRepository.create({
    id: crypto.randomUUID(),
    ownerId: userId,
    deviceCode,
    name: data.name,
    location: data.location || '',
    model: data.model || '',
    serialNumber: data.serialNumber || '',
    ratedPowerKw: data.ratedPowerKw,
    ratedVoltage: data.ratedVoltage,
    ratedCurrent: data.ratedCurrent,
    status: data.status || 'active',
    connectionStatus: 'disconnected',
    notes: data.notes || '',
    createdAt: now,
    updatedAt: now,
  }));
}

async function getMotor(userId, id) {
  const motor = await motorRepository.findById(id);

  if (!motor || motor.ownerId !== userId) {
    throw httpError(404, 'Không tìm thấy motor');
  }

  return withEffectiveConnectionStatus(motor);
}

async function updateMotor(userId, id, payload) {
  await getMotor(userId, id);

  const patch = motorValidator.update(payload);
  if (patch.deviceCode) {
    const duplicate = await motorRepository.findByDeviceCode(patch.deviceCode);
    if (duplicate && duplicate.id !== id) {
      throw httpError(409, 'Mã thiết bị đã tồn tại');
    }
  }

  return withEffectiveConnectionStatus(await motorRepository.update(id, patch));
}

async function deleteMotor(userId, id) {
  const motor = await getMotor(userId, id);
  const deleted = await motorRepository.remove(id);
  if (!deleted) {
    throw httpError(404, 'Không tìm thấy motor');
  }

  const remainingMotors = await motorRepository.findAllByOwner(userId);
  return {
    deletedMotorId: motor.id,
    nextMotorId: remainingMotors[0]?.id || null,
    remainingCount: remainingMotors.length,
  };
}

async function setConnection(userId, id, connected) {
  await getMotor(userId, id);
  if (connected !== false) {
    throw httpError(400, 'Thiết bị chỉ được đánh dấu trực tuyến sau khi gửi dữ liệu hợp lệ');
  }
  return withEffectiveConnectionStatus(await motorRepository.update(id, {
    connectionStatus: 'disconnected',
  }));
}

async function createDeviceToken(userId, id) {
  const motor = await getMotor(userId, id);
  const token = crypto.randomBytes(24).toString('hex');
  const deviceTokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await motorRepository.updateDeviceTokenHash(id, deviceTokenHash);

  return {
    deviceCode: motor.deviceCode,
    token,
  };
}

module.exports = {
  listMotors,
  createMotor,
  getMotor,
  updateMotor,
  deleteMotor,
  setConnection,
  createDeviceToken,
};
