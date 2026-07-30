CREATE TABLE user_settings (
  user_id TEXT PRIMARY KEY,
  language TEXT NOT NULL DEFAULT 'vi'
    CHECK (language IN ('vi', 'en')),
  theme TEXT NOT NULL DEFAULT 'light'
    CHECK (theme IN ('light', 'system')),
  email_notifications INTEGER NOT NULL DEFAULT 1
    CHECK (email_notifications IN (0, 1)),
  browser_notifications INTEGER NOT NULL DEFAULT 1
    CHECK (browser_notifications IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
