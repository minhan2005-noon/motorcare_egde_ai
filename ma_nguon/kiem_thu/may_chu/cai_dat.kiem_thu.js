const test = require('node:test');
const assert = require('node:assert/strict');
const authService = require('../../may_chu/dich_vu/xac_thuc.dich_vu');
const userService = require('../../may_chu/dich_vu/nguoi_dung.dich_vu');

test('appearance and accessibility settings are persisted', async () => {
  const result = await authService.register({
    email: `settings-${Date.now()}@example.com`,
    name: 'Settings Test',
    password: 'Secret123!',
  });

  const updated = await userService.updateSettings(result.user.id, {
    language: 'en',
    theme: 'dark',
    emailNotifications: false,
    browserNotifications: true,
    fontScale: 'large',
    density: 'compact',
    highContrast: true,
    reducedMotion: true,
    enable3d: false,
    refreshInterval: 30,
  });

  assert.deepEqual(
    {
      language: updated.language,
      theme: updated.theme,
      fontScale: updated.fontScale,
      density: updated.density,
      highContrast: updated.highContrast,
      reducedMotion: updated.reducedMotion,
      enable3d: updated.enable3d,
      refreshInterval: updated.refreshInterval,
    },
    {
      language: 'en',
      theme: 'dark',
      fontScale: 'large',
      density: 'compact',
      highContrast: true,
      reducedMotion: true,
      enable3d: false,
      refreshInterval: 30,
    },
  );
});
