const { getDatabase } = require('../co_so_du_lieu/ket_noi');

async function consume(bucketKey, windowMs) {
  const now = new Date();
  const nowIso = now.toISOString();
  const nextResetAt = new Date(now.getTime() + windowMs).toISOString();
  const db = getDatabase();

  await db.prepare(`
    INSERT INTO rate_limit_buckets (bucket_key, count, reset_at, updated_at)
    VALUES (?, 1, ?, ?)
    ON CONFLICT(bucket_key) DO UPDATE SET
      count = CASE
        WHEN rate_limit_buckets.reset_at <= excluded.updated_at THEN 1
        ELSE rate_limit_buckets.count + 1
      END,
      reset_at = CASE
        WHEN rate_limit_buckets.reset_at <= excluded.updated_at THEN excluded.reset_at
        ELSE rate_limit_buckets.reset_at
      END,
      updated_at = excluded.updated_at
  `).run(bucketKey, nextResetAt, nowIso);

  const bucket = await db.prepare(`
    SELECT count, reset_at FROM rate_limit_buckets WHERE bucket_key = ?
  `).get(bucketKey);

  if (Math.random() < 0.02) {
    await db.prepare('DELETE FROM rate_limit_buckets WHERE reset_at < ?').run(nowIso);
  }
  return {
    count: Number(bucket.count),
    resetAt: bucket.reset_at,
  };
}

module.exports = { consume };
