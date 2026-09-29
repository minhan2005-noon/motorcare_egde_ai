const userRepository = require('../kho_du_lieu/nguoi_dung.kho_du_lieu');
const settingsRepository = require('../kho_du_lieu/cai_dat.kho_du_lieu');
const authValidator = require('../kiem_tra/xac_thuc.kiem_tra');
const httpError = require('../tien_ich/loi_http');

async function updateProfile(userId, payload) {
  const patch = {};

  if (payload.fullName !== undefined) {
    const fullName = String(payload.fullName).trim();
    if (fullName.length < 2 || fullName.length > 80) {
      throw httpError(400, 'Họ tên phải từ 2 đến 80 ký tự');
    }
    patch.fullName = fullName;
  }

  if (payload.email !== undefined) {
    const email = authValidator.normalizeEmail(payload.email);
    const duplicate = await userRepository.findByEmail(email);
    if (duplicate && duplicate.id !== userId) {
      throw httpError(409, 'Email đã được sử dụng');
    }
    patch.email = email;
  }

  if (!Object.keys(patch).length) {
    throw httpError(400, 'Không có thông tin cần cập nhật');
  }
  return userRepository.updateProfile(userId, patch);
}

async function getSettings(userId) {
  return settingsRepository.findByUserId(userId);
}

async function updateSettings(userId, payload) {
  const current = await getSettings(userId);
  const settings = {
    language: payload.language ?? current.language,
    theme: payload.theme ?? current.theme,
    emailNotifications: payload.emailNotifications ?? current.emailNotifications,
    browserNotifications: payload.browserNotifications ?? current.browserNotifications,
    fontScale: payload.fontScale ?? current.fontScale,
    density: payload.density ?? current.density,
    highContrast: payload.highContrast ?? current.highContrast,
    reducedMotion: payload.reducedMotion ?? current.reducedMotion,
    refreshInterval: Number(payload.refreshInterval ?? current.refreshInterval),
  };

  if (!['vi', 'en'].includes(settings.language)) {
    throw httpError(400, 'Ngôn ngữ không hợp lệ');
  }
  if (!['light', 'dark', 'system'].includes(settings.theme)) {
    throw httpError(400, 'Giao diện không hợp lệ');
  }
  if (!['small', 'normal', 'large'].includes(settings.fontScale)) {
    throw httpError(400, 'Cỡ chữ không hợp lệ');
  }
  if (!['comfortable', 'compact'].includes(settings.density)) {
    throw httpError(400, 'Mật độ hiển thị không hợp lệ');
  }
  if (![3, 5, 10, 30, 60].includes(settings.refreshInterval)) {
    throw httpError(400, 'Chu kỳ làm mới không hợp lệ');
  }

  ['emailNotifications', 'browserNotifications', 'highContrast', 'reducedMotion']
    .forEach((key) => {
      if (typeof settings[key] !== 'boolean') {
        throw httpError(400, 'Giá trị tùy chọn không hợp lệ');
      }
    });

  return settingsRepository.update(userId, settings);
}

module.exports = {
  updateProfile,
  getSettings,
  updateSettings,
};
