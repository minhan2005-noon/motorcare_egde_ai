const buckets = new Map();

function createRateLimit({ windowMs, max, message }) {
  return (req, res, next) => {
    const identity = `${req.ip}:${String(req.body?.email || '').toLowerCase()}`;
    const now = Date.now();
    const current = buckets.get(identity);

    if (!current || current.resetAt <= now) {
      buckets.set(identity, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > max) {
      res.setHeader('Retry-After', Math.ceil((current.resetAt - now) / 1000));
      return res.status(429).json({
        success: false,
        message,
      });
    }

    return next();
  };
}

module.exports = createRateLimit;
