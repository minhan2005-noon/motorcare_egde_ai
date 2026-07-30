const { getDatabase } = require('../co_so_du_lieu/ket_noi');

async function create(token) {
  const db = getDatabase();
  db.prepare(`
    UPDATE password_reset_tokens
    SET used_at = ?
    WHERE user_id = ? AND used_at IS NULL
  `).run(token.createdAt, token.userId);

  db.prepare(`
    INSERT INTO password_reset_tokens (
      id, user_id, token_hash, expires_at, created_at
    ) VALUES (?, ?, ?, ?, ?)
  `).run(token.id, token.userId, token.tokenHash, token.expiresAt, token.createdAt);
}

async function findValid(tokenHash) {
  return getDatabase().prepare(`
    SELECT * FROM password_reset_tokens
    WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
    LIMIT 1
  `).get(tokenHash, new Date().toISOString()) || null;
}

async function findLatestActiveForUser(userId) {
  return getDatabase().prepare(`
    SELECT * FROM password_reset_tokens
    WHERE user_id = ? AND used_at IS NULL AND expires_at > ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(userId, new Date().toISOString()) || null;
}

async function incrementAttempts(id) {
  getDatabase().prepare(`
    UPDATE password_reset_tokens
    SET attempt_count = attempt_count + 1
    WHERE id = ?
  `).run(id);
}

async function markVerified(id) {
  getDatabase().prepare(`
    UPDATE password_reset_tokens SET verified_at = ? WHERE id = ?
  `).run(new Date().toISOString(), id);
}

async function markUsed(id) {
  getDatabase().prepare(`
    UPDATE password_reset_tokens SET used_at = ? WHERE id = ?
  `).run(new Date().toISOString(), id);
}

module.exports = {
  create,
  findValid,
  findLatestActiveForUser,
  incrementAttempts,
  markVerified,
  markUsed,
};
