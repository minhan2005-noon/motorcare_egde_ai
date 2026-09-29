const crypto = require('crypto');
const { getDatabase } = require('../co_so_du_lieu/ket_noi');

function mapSession(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  };
}

async function create(session) {
  await getDatabase().prepare(`
    INSERT INTO sessions (
      id, user_id, token_hash, expires_at, ip_address, user_agent, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    session.userId,
    session.tokenHash,
    session.expiresAt,
    session.ipAddress || null,
    session.userAgent || null,
    session.createdAt,
  );
}

async function findValidByTokenHash(tokenHash) {
  const row = await getDatabase().prepare(`
    SELECT * FROM sessions
    WHERE token_hash = ? AND expires_at > ?
    LIMIT 1
  `).get(tokenHash, new Date().toISOString());
  return mapSession(row);
}

async function removeByTokenHash(tokenHash) {
  return (await getDatabase().prepare(
    'DELETE FROM sessions WHERE token_hash = ?',
  ).run(tokenHash)).changes > 0;
}

async function removeAllForUser(userId) {
  return (await getDatabase().prepare(
    'DELETE FROM sessions WHERE user_id = ?',
  ).run(userId)).changes;
}

async function removeExpired() {
  return (await getDatabase().prepare(
    'DELETE FROM sessions WHERE expires_at <= ?',
  ).run(new Date().toISOString())).changes;
}

module.exports = {
  create,
  findValidByTokenHash,
  removeByTokenHash,
  removeAllForUser,
  removeExpired,
};
