const { getDatabase } = require('../co_so_du_lieu/ket_noi');

function mapCalibration(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    motorId: row.motor_id,
    createdBy: row.created_by,
    sampleCount: row.sample_count,
    vibrationBaseline: row.vibration_baseline,
    currentBaseline: row.current_baseline,
    temperatureBaseline: row.temperature_baseline,
    soundBaseline: row.sound_baseline,
    thresholds: JSON.parse(row.thresholds_json),
    notes: row.notes,
    createdAt: row.created_at,
  };
}

async function create(calibration) {
  await getDatabase().prepare(`
    INSERT INTO calibrations (
      id, motor_id, created_by, sample_count, vibration_baseline,
      current_baseline, temperature_baseline, sound_baseline,
      thresholds_json, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    calibration.id,
    calibration.motorId,
    calibration.createdBy,
    calibration.sampleCount,
    calibration.vibrationBaseline,
    calibration.currentBaseline,
    calibration.temperatureBaseline,
    calibration.soundBaseline,
    JSON.stringify(calibration.thresholds),
    calibration.notes,
    calibration.createdAt,
  );
  return findById(calibration.id);
}

async function findById(id) {
  return mapCalibration(await getDatabase().prepare(
    'SELECT * FROM calibrations WHERE id = ?',
  ).get(id));
}

async function findByMotor(motorId, limit = 20) {
  return (await getDatabase().prepare(`
    SELECT * FROM calibrations
    WHERE motor_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(motorId, limit)).map(mapCalibration);
}

async function findLatest(motorId) {
  return mapCalibration(await getDatabase().prepare(`
    SELECT * FROM calibrations
    WHERE motor_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(motorId));
}

module.exports = {
  create,
  findById,
  findByMotor,
  findLatest,
};
