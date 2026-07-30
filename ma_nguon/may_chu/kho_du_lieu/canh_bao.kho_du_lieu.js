const crypto = require('crypto');
const { getDatabase } = require('../co_so_du_lieu/ket_noi');

function mapAlert(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    motorId: row.motor_id,
    motorName: row.motor_name,
    type: row.type,
    message: row.message,
    severity: row.severity,
    confidence: row.confidence,
    status: row.status,
    source: row.source,
    acknowledgedBy: row.acknowledged_by,
    acknowledgedAt: row.acknowledged_at,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function create(alert) {
  const now = new Date().toISOString();
  const id = alert.id || crypto.randomUUID();
  getDatabase().prepare(`
    INSERT INTO alerts (
      id, motor_id, type, message, severity, confidence,
      status, source, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    alert.motorId,
    alert.type,
    alert.message,
    alert.severity,
    alert.confidence ?? null,
    alert.status || 'open',
    alert.source || 'system',
    alert.createdAt || now,
    now,
  );
  return findById(id);
}

async function findById(id) {
  const row = getDatabase().prepare(`
    SELECT alerts.*, motors.name AS motor_name
    FROM alerts
    JOIN motors ON motors.id = alerts.motor_id
    WHERE alerts.id = ?
  `).get(id);
  return mapAlert(row);
}

async function findByOwner(ownerId, options = {}) {
  const clauses = ['motors.owner_id = ?'];
  const values = [ownerId];
  if (options.motorId) {
    clauses.push('alerts.motor_id = ?');
    values.push(options.motorId);
  }
  if (options.status) {
    clauses.push('alerts.status = ?');
    values.push(options.status);
  }
  if (options.severity) {
    clauses.push('alerts.severity = ?');
    values.push(options.severity);
  }
  const limit = Math.min(Math.max(Number(options.limit) || 100, 1), 500);
  values.push(limit);

  return getDatabase().prepare(`
    SELECT alerts.*, motors.name AS motor_name
    FROM alerts
    JOIN motors ON motors.id = alerts.motor_id
    WHERE ${clauses.join(' AND ')}
    ORDER BY alerts.created_at DESC
    LIMIT ?
  `).all(...values).map(mapAlert);
}

async function countOpenByOwner(ownerId) {
  return getDatabase().prepare(`
    SELECT COUNT(*) AS count
    FROM alerts
    JOIN motors ON motors.id = alerts.motor_id
    WHERE motors.owner_id = ? AND alerts.status != 'resolved'
  `).get(ownerId).count;
}

async function findRecentOpen(motorId, type, minutes = 15) {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  const row = getDatabase().prepare(`
    SELECT alerts.*, motors.name AS motor_name
    FROM alerts
    JOIN motors ON motors.id = alerts.motor_id
    WHERE alerts.motor_id = ? AND alerts.type = ?
      AND alerts.status != 'resolved' AND alerts.created_at >= ?
    ORDER BY alerts.created_at DESC
    LIMIT 1
  `).get(motorId, type, cutoff);
  return mapAlert(row);
}

async function updateStatus(id, status, userId) {
  const now = new Date().toISOString();
  const acknowledgedAt = status === 'acknowledged' ? now : null;
  const resolvedAt = status === 'resolved' ? now : null;

  getDatabase().prepare(`
    UPDATE alerts
    SET status = ?,
        acknowledged_by = CASE WHEN ? = 'acknowledged' THEN ? ELSE acknowledged_by END,
        acknowledged_at = CASE WHEN ? = 'acknowledged' THEN ? ELSE acknowledged_at END,
        resolved_at = CASE WHEN ? = 'resolved' THEN ? ELSE resolved_at END,
        updated_at = ?
    WHERE id = ?
  `).run(
    status,
    status,
    userId,
    status,
    acknowledgedAt,
    status,
    resolvedAt,
    now,
    id,
  );
  return findById(id);
}

module.exports = {
  create,
  findById,
  findByOwner,
  countOpenByOwner,
  findRecentOpen,
  updateStatus,
};
