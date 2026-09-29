const test = require('node:test');
const assert = require('node:assert/strict');
const authService = require('../../may_chu/dich_vu/xac_thuc.dich_vu');
const userRepository = require('../../may_chu/kho_du_lieu/nguoi_dung.kho_du_lieu');

test('register creates a user and returns a token', async () => {
  const result = await authService.register({
    email: `auth-${Date.now()}@example.com`,
    name: 'Auth Test',
    password: 'Secret123!',
  });

  assert.equal(result.user.name, 'Auth Test');
  assert.equal(result.user.role, 'engineer');
  assert.equal(typeof result.token, 'string');
  assert.ok(result.token.length > 20);
  assert.equal(Object.hasOwn(result.user, 'passwordHash'), false);
});

test('login rejects invalid credentials', async () => {
  const email = `bad-login-${Date.now()}@example.com`;

  await authService.register({
    email,
    name: 'Bad Login Test',
    password: 'Secret123!',
  });

  await assert.rejects(
    () => authService.login({ email, password: 'wrong-password' }),
    /Email hoặc mật khẩu không đúng/,
  );
});

test('concurrent failed logins increment atomically and lock the account', async () => {
  const email = `locked-login-${Date.now()}@example.com`;
  const registration = await authService.register({
    email,
    name: 'Locked Login Test',
    password: 'Secret123!',
  });
  await Promise.allSettled(Array.from({ length: 5 }, () => (
    authService.login({ email, password: 'wrong-password' })
  )));
  const user = await userRepository.findById(registration.user.id);
  assert.equal(user.failedLoginAttempts, 5);
  assert.ok(new Date(user.lockedUntil).getTime() > Date.now());
  await assert.rejects(
    () => authService.login({ email, password: 'Secret123!' }),
    /Tài khoản tạm khóa/,
  );
});

test('password reset code is verified, single-use and invalidates the old password', async () => {
  const email = `reset-${Date.now()}@example.com`;

  await authService.register({
    email,
    name: 'Reset Password Test',
    password: 'Secret123!',
  });

  const resetRequest = await authService.forgotPassword({ email });
  assert.match(resetRequest.developmentResetCode, /^\d{6}$/);

  await authService.verifyResetCode({
    email,
    code: resetRequest.developmentResetCode,
  });
  await authService.resetPassword({
    email,
    code: resetRequest.developmentResetCode,
    password: 'Changed456!',
  });

  await assert.rejects(
    () => authService.login({ email, password: 'Secret123!' }),
    /Email hoặc mật khẩu không đúng/,
  );

  const login = await authService.login({ email, password: 'Changed456!' });
  assert.equal(login.user.email, email);

  await assert.rejects(
    () => authService.resetPassword({
      email,
      code: resetRequest.developmentResetCode,
      password: 'Another789!',
    }),
    /không hợp lệ hoặc đã hết hạn/,
  );
});

test('password reset code rejects incorrect attempts', async () => {
  const email = `reset-attempt-${Date.now()}@example.com`;

  await authService.register({
    email,
    name: 'Reset Attempt Test',
    password: 'Secret123!',
  });
  await authService.forgotPassword({ email });

  await assert.rejects(
    () => authService.verifyResetCode({ email, code: '000000' }),
    /không hợp lệ hoặc đã hết hạn/,
  );
});
