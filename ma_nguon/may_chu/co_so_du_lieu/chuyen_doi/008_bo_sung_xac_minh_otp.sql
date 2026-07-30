ALTER TABLE password_reset_tokens
ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE password_reset_tokens
ADD COLUMN verified_at TEXT;
