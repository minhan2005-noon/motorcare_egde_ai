const test = require('node:test');
const assert = require('node:assert/strict');
const AdmZip = require('adm-zip');
const authService = require('../../may_chu/dich_vu/xac_thuc.dich_vu');
const motorService = require('../../may_chu/dich_vu/dong_co.dich_vu');
const deviceService = require('../../may_chu/dich_vu/thiet_bi.dich_vu');
const sensorService = require('../../may_chu/dich_vu/cam_bien.dich_vu');
const alertService = require('../../may_chu/dich_vu/canh_bao.dich_vu');
const dashboardService = require('../../may_chu/dich_vu/bang_dieu_khien.dich_vu');
const firmwarePackageService = require('../../may_chu/dich_vu/goi_phan_mem_nhung.dich_vu');

test('firmware package injects connection values without manual source edits', () => {
  const packaged = firmwarePackageService.createPackage({
    endpoint: 'https://motorcare.example/api/devices/readings',
    deviceCode: 'MC-EDGE-2606',
    deviceToken: 'secret-device-token',
    publicViewUrl: 'https://motorcare.example/view/public-token',
    wifi: { ssid: 'MotorCare Lab', password: 'WifiPass123!' },
  });
  const archive = new AdmZip(Buffer.from(packaged.base64, 'base64'));
  const names = archive.getEntries().map((entry) => entry.entryName);
  const sketchName = names.find((name) => name.endsWith('/src/cham_soc_dong_co.ino'));
  const guideName = names.find((name) => name.endsWith('/HUONG_DAN.txt'));
  const viewName = names.find((name) => name.endsWith('/LINK_XEM_KHACH_HANG.txt'));

  assert.match(packaged.filename, /^MotorCare_MC_EDGE_2606\.zip$/);
  assert.ok(sketchName);
  assert.ok(names.some((name) => name.endsWith('/platformio.ini')));
  assert.equal(archive.readAsText(viewName).trim(), 'https://motorcare.example/view/public-token');
  assert.match(archive.readAsText(guideName), /Khong can sua SERVER_URL/);

  const sketch = archive.readAsText(sketchName);
  assert.match(sketch, /const char \*WIFI_SSID = "MotorCare Lab";/);
  assert.match(sketch, /const char \*WIFI_PASSWORD = "WifiPass123!";/);
  assert.match(sketch, /const char \*SERVER_URL = "https:\/\/motorcare\.example\/api\/devices\/readings";/);
  assert.match(sketch, /const char \*DEVICE_CODE = "MC-EDGE-2606";/);
  assert.match(sketch, /const char \*DEVICE_TOKEN = "secret-device-token";/);
  assert.doesNotMatch(sketch, /TEN_WIFI_CUA_BAN|THAY_MA_KET_NOI_TAI_DAY/);
});

test('firmware package rejects invalid Wi-Fi before creating a downloadable secret', () => {
  assert.throws(
    () => firmwarePackageService.validateWifi({ ssid: '', password: '12345678' }),
    /Tên Wi-Fi/,
  );
  assert.throws(
    () => firmwarePackageService.validateWifi({ ssid: 'MotorCare', password: 'short' }),
    /Mật khẩu Wi-Fi/,
  );
});

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
