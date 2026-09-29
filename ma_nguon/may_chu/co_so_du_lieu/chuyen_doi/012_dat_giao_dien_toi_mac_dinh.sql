UPDATE user_settings
SET theme = 'dark', updated_at = CURRENT_TIMESTAMP
WHERE theme IN ('light', 'system');
