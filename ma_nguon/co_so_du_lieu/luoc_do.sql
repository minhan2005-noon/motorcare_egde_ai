-- MotorCare Edge AI uses the versioned SQL files in
-- ma_nguon/may_chu/database/migrations as its executable schema.
-- Start the server once to create data/motorcare.sqlite automatically.

SELECT filename, applied_at
FROM schema_migrations
ORDER BY filename;
