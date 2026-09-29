const { getDatabase } = require('../co_so_du_lieu/ket_noi');

function mapSettings(row) {
  return {
    language: row.language,
    theme: row.theme,
    emailNotifications: Boolean(row.email_notifications),
    browserNotifications: Boolean(row.browser_notifications),
    fontScale: row.font_scale,
    density: row.density,
    highContrast: Boolean(row.high_contrast),
    reducedMotion: Boolean(row.reduced_motion),
    refreshInterval: row.refresh_interval,
    updatedAt: row.updated_at,
  };
}

async function findByUserId(userId) {
  const row = await getDatabase().prepare(
    'SELECT * FROM user_settings WHERE user_id = ?',
  ).get(userId);
  return row ? mapSettings(row) : null;
}

async function update(userId, settings) {
  const now = new Date().toISOString();
  await getDatabase().prepare(`
    UPDATE user_settings
    SET language = ?, theme = ?, email_notifications = ?,
        browser_notifications = ?, font_scale = ?, density = ?,
        high_contrast = ?, reduced_motion = ?,
        refresh_interval = ?, updated_at = ?
    WHERE user_id = ?
  `).run(
    settings.language,
    settings.theme,
    Number(settings.emailNotifications),
    Number(settings.browserNotifications),
    settings.fontScale,
    settings.density,
    Number(settings.highContrast),
    Number(settings.reducedMotion),
    settings.refreshInterval,
    now,
    userId,
  );
  return findByUserId(userId);
}

module.exports = {
  findByUserId,
  update,
};
