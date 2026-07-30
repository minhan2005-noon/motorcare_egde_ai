const httpError = require('../tien_ich/loi_http');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    throw httpError(400, 'Email không hợp lệ');
  }
  return email;
}

function validatePassword(value) {
  const password = String(value || '');
  const errors = [];

  if (password.length < 8) errors.push('ít nhất 8 ký tự');
  if (!/[a-z]/.test(password)) errors.push('một chữ thường');
  if (!/[A-Z]/.test(password)) errors.push('một chữ hoa');
  if (!/\d/.test(password)) errors.push('một chữ số');

  if (errors.length) {
    throw httpError(400, `Mật khẩu cần có ${errors.join(', ')}`);
  }
  if (password.length > 128) {
    throw httpError(400, 'Mật khẩu không được dài quá 128 ký tự');
  }

  return password;
}

function register(payload) {
  const fullName = String(payload.fullName || payload.name || '').trim();
  if (fullName.length < 2 || fullName.length > 80) {
    throw httpError(400, 'Họ tên phải từ 2 đến 80 ký tự');
  }

  return {
    fullName,
    email: normalizeEmail(payload.email),
    password: validatePassword(payload.password),
  };
}

function login(payload) {
  const password = String(payload.password || '');
  if (!password) {
    throw httpError(400, 'Vui lòng nhập mật khẩu');
  }

  return {
    email: normalizeEmail(payload.email),
    password,
    rememberMe: Boolean(payload.rememberMe),
  };
}

function forgotPassword(payload) {
  return {
    email: normalizeEmail(payload.email),
  };
}

function verifyResetCode(payload) {
  const code = String(payload.code || '').trim();
  if (!/^\d{6}$/.test(code)) {
    throw httpError(400, 'Mã xác minh phải gồm 6 chữ số');
  }

  return {
    email: normalizeEmail(payload.email),
    code,
  };
}

function resetPassword(payload) {
  const verification = verifyResetCode(payload);

  return {
    ...verification,
    password: validatePassword(payload.password),
  };
}

function changePassword(payload) {
  const currentPassword = String(payload.currentPassword || '');
  if (!currentPassword) {
    throw httpError(400, 'Vui lòng nhập mật khẩu hiện tại');
  }

  return {
    currentPassword,
    newPassword: validatePassword(payload.newPassword),
  };
}

module.exports = {
  normalizeEmail,
  validatePassword,
  register,
  login,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  changePassword,
};
