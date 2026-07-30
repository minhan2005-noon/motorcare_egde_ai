CREATE TABLE calibrations (
  id TEXT PRIMARY KEY,
  motor_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  sample_count INTEGER NOT NULL,
  vibration_baseline REAL,
  current_baseline REAL,
  temperature_baseline REAL,
  sound_baseline REAL,
  thresholds_json TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (motor_id) REFERENCES motors (id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX calibrations_motor_time_idx
  ON calibrations (motor_id, created_at DESC);
