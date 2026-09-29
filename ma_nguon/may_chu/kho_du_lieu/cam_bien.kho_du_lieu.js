const { getDatabase } = require('../co_so_du_lieu/ket_noi');

function mapReading(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    motorId: row.motor_id,
    recordedAt: row.recorded_at,
    vibrationRms: row.vibration_rms,
    currentRms: row.current_rms,
    temperature: row.temperature,
    soundLevel: row.sound_level,
    rpm: row.rpm,
    accelerationRmsG: row.acceleration_rms_g,
    voltageV: row.voltage_v,
    faultState: row.fault_state,
    jamProbability: row.jam_probability,
    vibrationProbability: row.vibration_probability,
    sagProbability: row.sag_probability,
    uptimeMs: row.uptime_ms,
    source: row.source,
    createdAt: row.created_at,
  };
}

async function create(reading) {
  const result = await getDatabase().prepare(`
    INSERT INTO sensor_readings (
      motor_id, recorded_at, vibration_rms, current_rms,
      temperature, sound_level, rpm, acceleration_rms_g, voltage_v,
      fault_state, jam_probability, vibration_probability, sag_probability,
      uptime_ms, source, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    reading.motorId,
    reading.recordedAt,
    reading.vibrationRms,
    reading.currentRms,
    reading.temperature,
    reading.soundLevel,
    reading.rpm,
    reading.accelerationRmsG ?? null,
    reading.voltageV ?? null,
    reading.faultState ?? null,
    reading.jamProbability ?? null,
    reading.vibrationProbability ?? null,
    reading.sagProbability ?? null,
    reading.uptimeMs ?? null,
    reading.source,
    reading.createdAt,
  );
  return findById(Number(result.lastInsertRowid));
}

async function findById(id) {
  return mapReading(await getDatabase().prepare(
    'SELECT * FROM sensor_readings WHERE id = ?',
  ).get(id));
}

async function findLatest(motorId) {
  return mapReading(await getDatabase().prepare(`
    SELECT * FROM sensor_readings
    WHERE motor_id = ?
    ORDER BY recorded_at DESC
    LIMIT 1
  `).get(motorId));
}

async function findByMotor(motorId, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 100, 1), 1000);
  const offset = Math.max(Number(options.offset) || 0, 0);
  const clauses = ['motor_id = ?'];
  const values = [motorId];

  if (options.from) {
    clauses.push('recorded_at >= ?');
    values.push(options.from);
  }
  if (options.to) {
    clauses.push('recorded_at <= ?');
    values.push(options.to);
  }

  values.push(limit, offset);
  const rows = await getDatabase().prepare(`
    SELECT * FROM sensor_readings
    WHERE ${clauses.join(' AND ')}
    ORDER BY recorded_at DESC
    LIMIT ? OFFSET ?
  `).all(...values);
  return rows.map(mapReading);
}

async function countByMotor(motorId) {
  return (await getDatabase().prepare(
    'SELECT COUNT(*) AS count FROM sensor_readings WHERE motor_id = ?',
  ).get(motorId)).count;
}

async function findSeries(motorId, limit = 30) {
  const rows = await getDatabase().prepare(`
    SELECT * FROM (
      SELECT * FROM sensor_readings
      WHERE motor_id = ?
      ORDER BY recorded_at DESC
      LIMIT ?
    ) ORDER BY recorded_at ASC
  `).all(motorId, limit);
  return rows.map(mapReading);
}

async function averages(motorId, sampleCount = 30) {
  return await getDatabase().prepare(`
    SELECT
      COUNT(*) AS sample_count,
      AVG(vibration_rms) AS vibration_baseline,
      AVG(current_rms) AS current_baseline,
      AVG(temperature) AS temperature_baseline,
      AVG(sound_level) AS sound_baseline
    FROM (
      SELECT * FROM sensor_readings
      WHERE motor_id = ?
      ORDER BY recorded_at DESC
      LIMIT ?
    )
  `).get(motorId, sampleCount);
}

module.exports = {
  create,
  findById,
  findLatest,
  findByMotor,
  countByMotor,
  findSeries,
  averages,
};
