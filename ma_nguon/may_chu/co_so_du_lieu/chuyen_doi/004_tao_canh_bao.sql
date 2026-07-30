CREATE TABLE alerts (
  id TEXT PRIMARY KEY,
  motor_id TEXT NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  confidence REAL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'acknowledged', 'resolved')),
  source TEXT NOT NULL DEFAULT 'system'
    CHECK (source IN ('system', 'ai', 'manual')),
  acknowledged_by TEXT,
  acknowledged_at TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (motor_id) REFERENCES motors (id) ON DELETE CASCADE,
  FOREIGN KEY (acknowledged_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX alerts_motor_time_idx ON alerts (motor_id, created_at DESC);
CREATE INDEX alerts_status_idx ON alerts (status, severity);
