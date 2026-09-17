const userRepository = require('../kho_du_lieu/nguoi_dung.kho_du_lieu');
const settingsRepository = require('../kho_du_lieu/cai_dat.kho_du_lieu');
const authValidator = require('../kiem_tra/xac_thuc.kiem_tra');
const httpError = require('../tien_ich/loi_http');

const PHONE_PATTERN = /^0(3|5|7|8|9)\d{8}$/;
const CITIZEN_ID_PATTERN = /^\d{12}$/;
const GENDERS = new Set(['male', 'female', 'other', 'prefer_not_to_say']);

function optionalValue(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

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

  if (payload.phone !== undefined) {
    let phone = optionalValue(payload.phone)?.replace(/[.\s-]/g, '') || null;
    if (phone?.startsWith('+84')) phone = `0${phone.slice(3)}`;
    if (phone && !PHONE_PATTERN.test(phone)) {
      throw httpError(400, 'Số điện thoại Việt Nam phải gồm 10 chữ số hợp lệ');
    }
    patch.phone = phone;
  }

  if (payload.gender !== undefined) {
    const gender = optionalValue(payload.gender);
    if (gender && !GENDERS.has(gender)) {
      throw httpError(400, 'Giới tính không hợp lệ');
    }
    patch.gender = gender;
  }

  if (payload.citizenId !== undefined) {
    const citizenId = optionalValue(payload.citizenId)?.replace(/\s/g, '') || null;
    if (citizenId && !CITIZEN_ID_PATTERN.test(citizenId)) {
      throw httpError(400, 'CCCD phải gồm đúng 12 chữ số');
    }
    patch.citizenId = citizenId;
  }

  if (!Object.keys(patch).length) {
    throw httpError(400, 'Không có thông tin cần cập nhật');
  }
  try {
    return await userRepository.updateProfile(userId, patch);
  } catch (error) {
    const constraintMessage = String(error.message || '');
    if (String(error.code || '').includes('CONSTRAINT') || constraintMessage.includes('UNIQUE constraint failed')) {
      if (constraintMessage.includes('users.phone')) {
        throw httpError(409, 'Số điện thoại đã được sử dụng');
      }
      if (constraintMessage.includes('users.citizen_id')) {
        throw httpError(409, 'CCCD đã được sử dụng');
      }
    }
    throw error;
  }
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
    enable3d: payload.enable3d ?? current.enable3d,
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

  ['emailNotifications', 'browserNotifications', 'highContrast', 'reducedMotion', 'enable3d']
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
