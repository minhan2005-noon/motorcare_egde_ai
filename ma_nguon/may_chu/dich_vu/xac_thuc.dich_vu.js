const crypto = require('crypto');
const appConfig = require('../cau_hinh/ung_dung.cau_hinh');
const userRepository = require('../kho_du_lieu/nguoi_dung.kho_du_lieu');
const sessionRepository = require('../kho_du_lieu/phien.kho_du_lieu');
const resetTokenRepository = require('../kho_du_lieu/ma_dat_lai.kho_du_lieu');
const emailService = require('./email.dich_vu');
const { hashPassword, verifyPassword } = require('../tien_ich/mat_khau');
const {
  createOpaqueToken,
  createNumericCode,
  hashToken,
  tokenMatches,
  expiresIn,
} = require('../tien_ich/ma_xac_thuc');
const authValidator = require('../kiem_tra/xac_thuc.kiem_tra');
const httpError = require('../tien_ich/loi_http');

async function createSession(userId, context = {}, rememberMe = false) {
  const token = createOpaqueToken();
  const expiresAt = expiresIn({
    days: rememberMe ? 30 : appConfig.sessionDays,
  });

  await sessionRepository.create({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    createdAt: new Date().toISOString(),
  });

  return { token, expiresAt };
}

async function register(payload, context = {}) {
  const data = authValidator.register(payload);

  const existingUser = await userRepository.findByEmail(data.email);
  if (existingUser) {
    throw httpError(409, 'Email đã được sử dụng');
  }

  const now = new Date().toISOString();
  const user = await userRepository.create({
    id: crypto.randomUUID(),
    email: data.email,
    fullName: data.fullName,
    role: 'engineer',
    passwordHash: await hashPassword(data.password),
    createdAt: now,
    updatedAt: now,
  });
  const session = await createSession(user.id, context);

  return {
    user,
    ...session,
  };
}

async function login(payload, context = {}) {
  const data = authValidator.login(payload);
  const user = await userRepository.findByEmail(data.email);

  if (!user) {
    await new Promise((resolve) => setTimeout(resolve, 180));
    throw httpError(401, 'Email hoặc mật khẩu không đúng');
  }
  if (!user.isActive) {
    throw httpError(403, 'Tài khoản đã bị vô hiệu hóa');
  }
  if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
    throw httpError(423, 'Tài khoản tạm khóa. Vui lòng thử lại sau 15 phút');
  }

  const passwordMatches = await verifyPassword(data.password, user.passwordHash);
  if (!passwordMatches) {
    const attempts = (user.failedLoginAttempts || 0) + 1;
    const lockedUntil = attempts >= 5
      ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
      : null;
    await userRepository.recordFailedLogin(user.id, attempts, lockedUntil);
    throw httpError(401, 'Email hoặc mật khẩu không đúng');
  }

  await userRepository.recordSuccessfulLogin(user.id);
  const session = await createSession(user.id, context, data.rememberMe);

  return {
    user: userRepository.toPublicUser(user),
    ...session,
  };
}

async function getMe(userId) {
  const user = await userRepository.findPublicById(userId);

  if (!user) {
    throw httpError(404, 'Không tìm thấy người dùng');
  }

  return user;
}

async function logout(token) {
  if (token) {
    await sessionRepository.removeByTokenHash(hashToken(token));
  }
}

async function logoutAll(userId) {
  await sessionRepository.removeAllForUser(userId);
}

async function forgotPassword(payload) {
  const { email } = authValidator.forgotPassword(payload);
  const user = await userRepository.findByEmail(email);
  const result = {
    message: 'Nếu email tồn tại, mã xác minh đã được gửi',
  };

  if (!user || !user.isActive) {
    await new Promise((resolve) => setTimeout(resolve, 180));
    return result;
  }

  const code = createNumericCode(6);
  const now = new Date().toISOString();
  const resetRecord = {
    id: crypto.randomUUID(),
    userId: user.id,
    tokenHash: hashToken(code),
    expiresAt: expiresIn({ minutes: appConfig.resetTokenMinutes }),
    createdAt: now,
  };
  await resetTokenRepository.create(resetRecord);

  try {
    await emailService.sendPasswordResetCode({
      recipient: user.email,
      code,
      expiresInMinutes: appConfig.resetTokenMinutes,
    });
  } catch (error) {
    await resetTokenRepository.markUsed(resetRecord.id);
    throw error;
  }

  if (appConfig.env === 'test') {
    result.developmentResetCode = code;
    result.deliveryMode = 'test';
  }

  return result;
}

async function getResetRecord(payload, requireVerified = false) {
  const data = authValidator.verifyResetCode(payload);
  const user = await userRepository.findByEmail(data.email);

  if (!user || !user.isActive) {
    await new Promise((resolve) => setTimeout(resolve, 180));
    throw httpError(400, 'Mã xác minh không hợp lệ hoặc đã hết hạn');
  }

  const resetRecord = await resetTokenRepository.findLatestActiveForUser(user.id);
  if (!resetRecord || resetRecord.attempt_count >= 5) {
    throw httpError(400, 'Mã xác minh không hợp lệ hoặc đã hết hạn');
  }

  if (!tokenMatches(data.code, resetRecord.token_hash)) {
    await resetTokenRepository.incrementAttempts(resetRecord.id);
    if (resetRecord.attempt_count + 1 >= 5) {
      await resetTokenRepository.markUsed(resetRecord.id);
    }
    throw httpError(400, 'Mã xác minh không hợp lệ hoặc đã hết hạn');
  }

  if (requireVerified && !resetRecord.verified_at) {
    throw httpError(400, 'Vui lòng xác minh mã trước khi đổi mật khẩu');
  }

  return { data, user, resetRecord };
}

async function verifyResetCode(payload) {
  const { resetRecord } = await getResetRecord(payload);
  await resetTokenRepository.markVerified(resetRecord.id);
  return {
    expiresAt: resetRecord.expires_at,
  };
}

async function resetPassword(payload) {
  const data = authValidator.resetPassword(payload);
  const { user, resetRecord } = await getResetRecord(data, true);

  await userRepository.updatePassword(
    user.id,
    await hashPassword(data.password),
  );
  await resetTokenRepository.markUsed(resetRecord.id);
  await sessionRepository.removeAllForUser(user.id);
}

async function changePassword(userId, payload) {
  const data = authValidator.changePassword(payload);
  const user = await userRepository.findById(userId);

  if (!user || !(await verifyPassword(data.currentPassword, user.passwordHash))) {
    throw httpError(400, 'Mật khẩu hiện tại không đúng');
  }
  if (data.currentPassword === data.newPassword) {
    throw httpError(400, 'Mật khẩu mới phải khác mật khẩu hiện tại');
  }

  await userRepository.updatePassword(userId, await hashPassword(data.newPassword));
  await sessionRepository.removeAllForUser(userId);
}

module.exports = {
  register,
  login,
  getMe,
  logout,
  logoutAll,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  changePassword,
};
