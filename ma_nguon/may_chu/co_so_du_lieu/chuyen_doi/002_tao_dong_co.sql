CREATE TABLE motors (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  device_code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  serial_number TEXT NOT NULL DEFAULT '',
  rated_power_kw REAL,
  rated_voltage REAL,
  rated_current REAL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'maintenance')),
  connection_status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (connection_status IN ('connected', 'disconnected')),
  last_seen_at TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX motors_owner_idx ON motors (owner_id);
CREATE INDEX motors_status_idx ON motors (status);
