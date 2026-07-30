CREATE TABLE sensor_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  motor_id TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  vibration_rms REAL,
  current_rms REAL,
  temperature REAL,
  sound_level REAL,
  rpm REAL,
  source TEXT NOT NULL DEFAULT 'device'
    CHECK (source IN ('device', 'manual', 'import')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (motor_id) REFERENCES motors (id) ON DELETE CASCADE
);

CREATE INDEX sensor_readings_motor_time_idx
  ON sensor_readings (motor_id, recorded_at DESC);
