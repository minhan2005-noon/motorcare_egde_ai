const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const appConfig = require('../cau_hinh/ung_dung.cau_hinh');
const httpError = require('../tien_ich/loi_http');

const firmwareRoot = path.join(appConfig.projectRoot, 'ma_nguon/phan_mem_nhung');

function validateWifi(wifi = {}) {
  const ssid = String(wifi.ssid || '').trim();
  const password = String(wifi.password || '');
  if (!ssid || Buffer.byteLength(ssid, 'utf8') > 32) {
    throw httpError(400, 'Tên Wi-Fi phải có từ 1 đến 32 byte');
  }
  if (password && (password.length < 8 || password.length > 63)) {
    throw httpError(400, 'Mật khẩu Wi-Fi phải có từ 8 đến 63 ký tự hoặc để trống');
  }
  return { ssid, password };
}

function cppString(value) {
  return JSON.stringify(String(value));
}

function replaceConstant(source, name, value) {
  const pattern = new RegExp(`const char \\*${name} = "[^"]*";`);
  if (!pattern.test(source)) {
    throw new Error(`Không tìm thấy cấu hình ${name} trong firmware mẫu`);
  }
  return source.replace(pattern, `const char *${name} = ${cppString(value)};`);
}

function readFirmwareFile(filename) {
  return fs.readFileSync(path.join(firmwareRoot, filename));
}

function safeProjectName(deviceCode) {
  return `MotorCare_${deviceCode.replace(/[^A-Za-z0-9]+/g, '_')}`;
}

function createPackage({ endpoint, deviceCode, deviceToken, publicViewUrl, wifi }) {
  const network = validateWifi(wifi);
  let firmware = readFirmwareFile('cham_soc_dong_co.ino').toString('utf8');
  firmware = replaceConstant(firmware, 'WIFI_SSID', network.ssid);
  firmware = replaceConstant(firmware, 'WIFI_PASSWORD', network.password);
  firmware = replaceConstant(firmware, 'SERVER_URL', endpoint);
  firmware = replaceConstant(firmware, 'DEVICE_CODE', deviceCode);
  firmware = replaceConstant(firmware, 'DEVICE_TOKEN', deviceToken);

  const projectName = safeProjectName(deviceCode);
  const root = `${projectName}/`;
  const zip = new AdmZip();
  zip.addFile(`${root}src/cham_soc_dong_co.ino`, Buffer.from(firmware));
  for (const filename of [
    'motorcare_features.h',
    'motorcare_predict.h',
    'motorcare_tls.h',
    'model_weights.h',
  ]) {
    zip.addFile(`${root}src/${filename}`, readFirmwareFile(filename));
  }
  zip.addFile(`${root}platformio.ini`, Buffer.from(`[platformio]\nsrc_dir = src\n\n[env:esp32dev]\nplatform = espressif32\nboard = esp32dev\nframework = arduino\nmonitor_speed = 115200\nlib_deps =\n  adafruit/Adafruit INA219@^1.2.3\n`));
  zip.addFile(`${root}LINK_XEM_KHACH_HANG.txt`, Buffer.from(`${publicViewUrl}\n`));
  zip.addFile(`${root}HUONG_DAN.txt`, Buffer.from([
    'MOTORCARE EDGE AI - GOI FIRMWARE DA CAU HINH',
    '',
    '1. Giai nen thu muc nay.',
    '2. Mo thu muc bang VS Code co PlatformIO.',
    '3. Cam ESP32 vao may tinh va chon Upload.',
    '4. Khong can sua SERVER_URL, DEVICE_CODE, DEVICE_TOKEN hoac Wi-Fi.',
    '5. Mo Serial Monitor 115200; Web: HTTP 201 nghia la gui du lieu thanh cong.',
    '',
    `Link xem cho khach: ${publicViewUrl}`,
    '',
    'Bao mat: goi nay chua ma ghi du lieu va mat khau Wi-Fi; khong chia se file ZIP.',
  ].join('\n')));

  return {
    filename: `${projectName}.zip`,
    contentType: 'application/zip',
    base64: zip.toBuffer().toString('base64'),
  };
}

module.exports = {
  createPackage,
  validateWifi,
};
