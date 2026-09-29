CREATE TABLE rate_limit_buckets (
  bucket_key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_rate_limit_buckets_reset_at ON rate_limit_buckets(reset_at);
