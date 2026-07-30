CREATE TABLE user_settings_new (
  user_id TEXT PRIMARY KEY,
  language TEXT NOT NULL DEFAULT 'vi'
    CHECK (language IN ('vi', 'en')),
  theme TEXT NOT NULL DEFAULT 'system'
    CHECK (theme IN ('light', 'dark', 'system')),
  email_notifications INTEGER NOT NULL DEFAULT 1
    CHECK (email_notifications IN (0, 1)),
  browser_notifications INTEGER NOT NULL DEFAULT 1
    CHECK (browser_notifications IN (0, 1)),
  font_scale TEXT NOT NULL DEFAULT 'normal'
    CHECK (font_scale IN ('small', 'normal', 'large')),
  density TEXT NOT NULL DEFAULT 'comfortable'
    CHECK (density IN ('comfortable', 'compact')),
  high_contrast INTEGER NOT NULL DEFAULT 0
    CHECK (high_contrast IN (0, 1)),
  reduced_motion INTEGER NOT NULL DEFAULT 0
    CHECK (reduced_motion IN (0, 1)),
  enable_3d INTEGER NOT NULL DEFAULT 1
    CHECK (enable_3d IN (0, 1)),
  refresh_interval INTEGER NOT NULL DEFAULT 10
    CHECK (refresh_interval IN (3, 5, 10, 30, 60)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

INSERT INTO user_settings_new (
  user_id,
  language,
  theme,
  email_notifications,
  browser_notifications,
  created_at,
  updated_at
)
SELECT
  user_id,
  language,
  theme,
  email_notifications,
  browser_notifications,
  created_at,
  updated_at
FROM user_settings;

DROP TABLE user_settings;
ALTER TABLE user_settings_new RENAME TO user_settings;
