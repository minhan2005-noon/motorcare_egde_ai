const test = require('node:test');
const assert = require('node:assert/strict');
const authService = require('../../may_chu/dich_vu/xac_thuc.dich_vu');
const userService = require('../../may_chu/dich_vu/nguoi_dung.dich_vu');

async function createUser(suffix) {
  return authService.register({
    email: `profile-${suffix}-${Date.now()}@example.com`,
    name: `Engineer ${suffix}`,
    password: 'Secret123!',
  });
}

test('engineer profile persists phone, gender and citizen ID', async () => {
  const registered = await createUser('complete');

  const updated = await userService.updateProfile(registered.user.id, {
    fullName: 'Nguyễn Kỹ Sư',
    email: `updated-${Date.now()}@example.com`,
    phone: '+84 901 234 567',
    gender: 'male',
    citizenId: '001204000123',
  });

  assert.equal(updated.fullName, 'Nguyễn Kỹ Sư');
  assert.equal(updated.phone, '0901234567');
  assert.equal(updated.gender, 'male');
  assert.equal(updated.citizenId, '001204000123');
});

test('engineer profile rejects invalid identity data', async () => {
  const registered = await createUser('invalid');

  await assert.rejects(
    () => userService.updateProfile(registered.user.id, { phone: '1234' }),
    /Số điện thoại Việt Nam/,
  );
  await assert.rejects(
    () => userService.updateProfile(registered.user.id, { citizenId: '123456' }),
    /CCCD phải gồm đúng 12 chữ số/,
  );
  await assert.rejects(
    () => userService.updateProfile(registered.user.id, { gender: 'unknown' }),
    /Giới tính không hợp lệ/,
  );
});

test('phone and citizen ID cannot belong to multiple accounts', async () => {
  const first = await createUser('first');
  const second = await createUser('second');

  await userService.updateProfile(first.user.id, {
    phone: '0909876543',
    citizenId: '079204000456',
  });

  await assert.rejects(
    () => userService.updateProfile(second.user.id, { phone: '0909876543' }),
    /Số điện thoại đã được sử dụng/,
  );
  await assert.rejects(
    () => userService.updateProfile(second.user.id, { citizenId: '079204000456' }),
    /CCCD đã được sử dụng/,
  );
});
