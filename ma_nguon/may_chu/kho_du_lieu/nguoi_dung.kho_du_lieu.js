const { getDatabase } = require('../co_so_du_lieu/ket_noi');

function mapUser(row, { includePassword = false } = {}) {
  if (!row) {
    return null;
  }

  const user = {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    name: row.full_name,
    role: row.role,
    isActive: Boolean(row.is_active),
    failedLoginAttempts: row.failed_login_attempts,
    lockedUntil: row.locked_until,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (includePassword) {
    user.passwordHash = row.password_hash;
  }

  return user;
}

async function create(user) {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO users (
      id, email, full_name, password_hash, role, is_active,
      failed_login_attempts, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)
  `).run(
    user.id,
    user.email,
    user.fullName,
    user.passwordHash,
    user.role,
    user.createdAt,
    user.updatedAt,
  );

  db.prepare(`
    INSERT INTO user_settings (
      user_id, language, theme, email_notifications,
      browser_notifications, created_at, updated_at
    ) VALUES (?, 'vi', 'light', 1, 1, ?, ?)
  `).run(user.id, user.createdAt, user.updatedAt);

  return findPublicById(user.id);
}

async function findById(id) {
  const row = getDatabase().prepare('SELECT * FROM users WHERE id = ?').get(id);
  return mapUser(row, { includePassword: true });
}

async function findPublicById(id) {
  const row = getDatabase().prepare('SELECT * FROM users WHERE id = ?').get(id);
  return mapUser(row);
}

async function findByEmail(email) {
  const row = getDatabase()
    .prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE')
    .get(email);
  return mapUser(row, { includePassword: true });
}

async function recordFailedLogin(id, attempts, lockedUntil) {
  getDatabase().prepare(`
    UPDATE users
    SET failed_login_attempts = ?, locked_until = ?, updated_at = ?
    WHERE id = ?
  `).run(attempts, lockedUntil, new Date().toISOString(), id);
}

async function recordSuccessfulLogin(id) {
  const now = new Date().toISOString();
  getDatabase().prepare(`
    UPDATE users
    SET failed_login_attempts = 0, locked_until = NULL,
        last_login_at = ?, updated_at = ?
    WHERE id = ?
  `).run(now, now, id);
}

async function updateProfile(id, patch) {
  const now = new Date().toISOString();
  getDatabase().prepare(`
    UPDATE users
    SET full_name = COALESCE(?, full_name),
        email = COALESCE(?, email),
        updated_at = ?
    WHERE id = ?
  `).run(patch.fullName ?? null, patch.email ?? null, now, id);
  return findPublicById(id);
}

async function updatePassword(id, passwordHash) {
  getDatabase().prepare(`
    UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?
  `).run(passwordHash, new Date().toISOString(), id);
}

module.exports = {
  create,
  findById,
  findPublicById,
  findByEmail,
  recordFailedLogin,
  recordSuccessfulLogin,
  updateProfile,
  updatePassword,
  toPublicUser: (user) => {
    if (!user) {
      return null;
    }
    const { passwordHash, failedLoginAttempts, lockedUntil, ...publicUser } = user;
    return publicUser;
  },
};
