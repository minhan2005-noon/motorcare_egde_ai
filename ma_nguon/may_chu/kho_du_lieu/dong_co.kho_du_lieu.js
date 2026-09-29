const { getDatabase } = require('../co_so_du_lieu/ket_noi');

function mapMotor(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    ownerId: row.owner_id,
    deviceCode: row.device_code,
    name: row.name,
    location: row.location,
    model: row.model,
    serialNumber: row.serial_number,
    ratedPowerKw: row.rated_power_kw,
    ratedVoltage: row.rated_voltage,
    ratedCurrent: row.rated_current,
    status: row.status,
    connectionStatus: row.connection_status,
    lastSeenAt: row.last_seen_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function create(motor) {
  await getDatabase().prepare(`
    INSERT INTO motors (
      id, owner_id, device_code, name, location, model, serial_number,
      rated_power_kw, rated_voltage, rated_current, status,
      connection_status, last_seen_at, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    motor.id,
    motor.ownerId,
    motor.deviceCode,
    motor.name,
    motor.location,
    motor.model,
    motor.serialNumber,
    motor.ratedPowerKw ?? null,
    motor.ratedVoltage ?? null,
    motor.ratedCurrent ?? null,
    motor.status,
    motor.connectionStatus,
    motor.lastSeenAt ?? null,
    motor.notes,
    motor.createdAt,
    motor.updatedAt,
  );
  return findById(motor.id);
}

async function findAllByOwner(ownerId) {
  return (await getDatabase().prepare(`
    SELECT * FROM motors WHERE owner_id = ? ORDER BY created_at DESC
  `).all(ownerId)).map(mapMotor);
}

async function findById(id) {
  return mapMotor(await getDatabase().prepare('SELECT * FROM motors WHERE id = ?').get(id));
}

async function findByDeviceCode(deviceCode) {
  return mapMotor(await getDatabase().prepare(
    'SELECT * FROM motors WHERE device_code = ? COLLATE NOCASE',
  ).get(deviceCode));
}

async function findDeviceCredentials(deviceCode) {
  const row = await getDatabase().prepare(
    'SELECT * FROM motors WHERE device_code = ? COLLATE NOCASE',
  ).get(deviceCode);

  if (!row) {
    return null;
  }

  return {
    motor: mapMotor(row),
    deviceTokenHash: row.device_token_hash,
  };
}

async function updateDeviceTokenHash(id, deviceTokenHash) {
  await getDatabase().prepare(`
    UPDATE motors
    SET device_token_hash = ?, updated_at = ?
    WHERE id = ?
  `).run(deviceTokenHash, new Date().toISOString(), id);
  return findById(id);
}

async function update(id, patch) {
  const current = await findById(id);
  if (!current) {
    return null;
  }

  const next = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  await getDatabase().prepare(`
    UPDATE motors SET
      device_code = ?, name = ?, location = ?, model = ?, serial_number = ?,
      rated_power_kw = ?, rated_voltage = ?, rated_current = ?, status = ?,
      connection_status = ?, last_seen_at = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `).run(
    next.deviceCode,
    next.name,
    next.location,
    next.model,
    next.serialNumber,
    next.ratedPowerKw,
    next.ratedVoltage,
    next.ratedCurrent,
    next.status,
    next.connectionStatus,
    next.lastSeenAt,
    next.notes,
    next.updatedAt,
    id,
  );
  return findById(id);
}

async function remove(id) {
  return (await getDatabase().prepare('DELETE FROM motors WHERE id = ?').run(id)).changes > 0;
}

module.exports = {
  mapMotor,
  create,
  findAllByOwner,
  findById,
  findByDeviceCode,
  findDeviceCredentials,
  updateDeviceTokenHash,
  update,
  remove,
};
