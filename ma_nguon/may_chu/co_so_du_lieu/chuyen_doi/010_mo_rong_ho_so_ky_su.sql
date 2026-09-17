ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN gender TEXT
  CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say'));
ALTER TABLE users ADD COLUMN citizen_id TEXT;

CREATE UNIQUE INDEX users_phone_unique_idx
  ON users (phone)
  WHERE phone IS NOT NULL;

CREATE UNIQUE INDEX users_citizen_id_unique_idx
  ON users (citizen_id)
  WHERE citizen_id IS NOT NULL;
