const crypto = require('crypto');
const userRepository = require('../kho_du_lieu/nguoi_dung.kho_du_lieu');
const motorRepository = require('../kho_du_lieu/dong_co.kho_du_lieu');
const sensorRepository = require('../kho_du_lieu/cam_bien.kho_du_lieu');
const alertRepository = require('../kho_du_lieu/canh_bao.kho_du_lieu');
const calibrationRepository = require('../kho_du_lieu/hieu_chuan.kho_du_lieu');
const { hashPassword } = require('../tien_ich/mat_khau');

const DEMO_EMAIL = 'demo@motorcare.vn';
const DEMO_PASSWORD = 'MotorCare123!';

function timestamp(minutesAgo) {
  return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
}

async function seedDatabase() {
  const existingUser = await userRepository.findByEmail(DEMO_EMAIL);
  if (existingUser) {
    const existingMotor = await motorRepository.findById('demo-motor-01');
    if (existingMotor && !existingMotor.lastSeenAt) {
      await motorRepository.update(existingMotor.id, {
        connectionStatus: 'connected',
        lastSeenAt: timestamp(1),
      });
    }
    return;
  }

  const now = new Date().toISOString();
  const user = await userRepository.create({
    id: 'demo-user-motorcare',
    email: DEMO_EMAIL,
    fullName: 'Nguyễn Văn An',
    role: 'engineer',
    passwordHash: await hashPassword(DEMO_PASSWORD),
    createdAt: now,
    updatedAt: now,
  });

  const motors = [
    {
      id: 'demo-motor-01',
      deviceCode: 'MC-EDGE-001',
      name: 'Motor bơm số 01',
      location: 'Xưởng A · Dây chuyền 1',
      model: 'Siemens 1LE1',
      serialNumber: 'SN-MC-0001',
      ratedPowerKw: 7.5,
      ratedVoltage: 380,
      ratedCurrent: 15.2,
      status: 'active',
      connectionStatus: 'connected',
      lastSeenAt: timestamp(1),
      notes: 'Motor chính của hệ thống bơm tuần hoàn.',
      createdAt: timestamp(1440),
    },
    {
      id: 'demo-motor-02',
      deviceCode: 'MC-EDGE-002',
      name: 'Motor quạt số 02',
      location: 'Xưởng A · Khu thông gió',
      model: 'ABB M2BAX',
      serialNumber: 'SN-MC-0002',
      ratedPowerKw: 5.5,
      ratedVoltage: 380,
      ratedCurrent: 11.6,
      status: 'maintenance',
      connectionStatus: 'disconnected',
      lastSeenAt: timestamp(95),
      notes: 'Đang chờ kiểm tra ổ bi.',
      createdAt: timestamp(2880),
    },
    {
      id: 'demo-motor-03',
      deviceCode: 'MC-EDGE-003',
      name: 'Motor băng tải số 03',
      location: 'Xưởng B · Dây chuyền đóng gói',
      model: 'WEG W22',
      serialNumber: 'SN-MC-0003',
      ratedPowerKw: 3.7,
      ratedVoltage: 380,
      ratedCurrent: 8.1,
      status: 'active',
      connectionStatus: 'connected',
      lastSeenAt: timestamp(2),
      notes: '',
      createdAt: timestamp(4320),
    },
  ];

  for (const motor of motors) {
    await motorRepository.create({
      ...motor,
      ownerId: user.id,
      updatedAt: now,
    });
  }

  for (let index = 0; index < 36; index += 1) {
    const oldestFirst = 35 - index;
    const wave = Math.sin(index / 2.8);
    await sensorRepository.create({
      motorId: motors[0].id,
      recordedAt: timestamp(oldestFirst * 2),
      vibrationRms: Number((2.45 + wave * 0.42 + (index % 7 === 0 ? 0.28 : 0)).toFixed(3)),
      currentRms: Number((4.82 + Math.sin(index / 3.4) * 0.48).toFixed(3)),
      temperature: Number((61.4 + index * 0.035 + Math.sin(index / 4) * 1.1).toFixed(3)),
      soundLevel: Number((58.2 + Math.cos(index / 3) * 1.8).toFixed(3)),
      rpm: Number((1450 + Math.sin(index / 2) * 18).toFixed(1)),
      source: 'device',
      createdAt: timestamp(oldestFirst * 2),
    });
  }

  for (let index = 0; index < 16; index += 1) {
    await sensorRepository.create({
      motorId: motors[2].id,
      recordedAt: timestamp((15 - index) * 4),
      vibrationRms: Number((3.1 + Math.sin(index / 2) * 0.6).toFixed(3)),
      currentRms: Number((5.4 + Math.cos(index / 2.5) * 0.5).toFixed(3)),
      temperature: Number((64.2 + Math.sin(index / 4) * 1.5).toFixed(3)),
      soundLevel: Number((61.5 + Math.cos(index / 3) * 2).toFixed(3)),
      rpm: 1435,
      source: 'device',
      createdAt: timestamp((15 - index) * 4),
    });
  }

  await calibrationRepository.create({
    id: crypto.randomUUID(),
    motorId: motors[0].id,
    createdBy: user.id,
    sampleCount: 30,
    vibrationBaseline: 2.45,
    currentBaseline: 4.82,
    temperatureBaseline: 62.3,
    soundBaseline: 58.7,
    thresholds: {
      vibrationWarning: 7.1,
      currentWarning: 18.2,
      temperatureWarning: 80,
      soundWarning: 85,
    },
    notes: 'Baseline ban đầu từ dữ liệu vận hành ổn định.',
    createdAt: timestamp(720),
  });

  await alertRepository.create({
    id: 'demo-alert-01',
    motorId: motors[1].id,
    type: 'Rung động cao',
    message: 'Rung động RMS vượt ngưỡng vận hành đã hiệu chuẩn',
    severity: 'high',
    confidence: null,
    status: 'open',
    source: 'system',
    createdAt: timestamp(92),
  });
  await alertRepository.create({
    id: 'demo-alert-02',
    motorId: motors[0].id,
    type: 'Nhiệt độ tăng',
    message: 'Nhiệt độ tăng liên tục trong 30 phút',
    severity: 'medium',
    confidence: null,
    status: 'acknowledged',
    source: 'system',
    createdAt: timestamp(185),
  });
  await alertRepository.create({
    id: 'demo-alert-03',
    motorId: motors[2].id,
    type: 'Mất kết nối ngắn',
    message: 'Thiết bị mất kết nối trong 48 giây và đã khôi phục',
    severity: 'low',
    confidence: null,
    status: 'resolved',
    source: 'system',
    createdAt: timestamp(340),
  });
}

if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log(`Đã tạo dữ liệu demo: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

module.exports = {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  seedDatabase,
};
