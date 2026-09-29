const { getDatabase } = require('../co_so_du_lieu/ket_noi');

async function record(entry) {
  await getDatabase().prepare(`
    INSERT INTO audit_logs (
      user_id, action, entity_type, entity_id,
      metadata_json, ip_address, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.userId || null,
    entry.action,
    entry.entityType,
    entry.entityId || null,
    entry.metadata ? JSON.stringify(entry.metadata) : null,
    entry.ipAddress || null,
    new Date().toISOString(),
  );
}

module.exports = {
  record,
};
