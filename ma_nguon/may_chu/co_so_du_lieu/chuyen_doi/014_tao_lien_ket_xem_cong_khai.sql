ALTER TABLE motors ADD COLUMN public_view_token_hash TEXT;

CREATE UNIQUE INDEX motors_public_view_token_hash_idx
ON motors (public_view_token_hash)
WHERE public_view_token_hash IS NOT NULL;
