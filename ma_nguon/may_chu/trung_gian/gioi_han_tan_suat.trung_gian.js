const crypto = require('crypto');
const rateLimitRepository = require('../kho_du_lieu/gioi_han_tan_suat.kho_du_lieu');

function createRateLimit({ windowMs, max, message }) {
  return async (req, res, next) => {
    try {
      const route = `${req.baseUrl}:${req.path}`;
      const email = String(req.body?.email || '').trim().toLowerCase();
      const identities = [`${route}:ip:${req.ip}`];
      if (email) identities.push(`${route}:email:${email}`);
      const buckets = await Promise.all(identities.map((identity) => (
        rateLimitRepository.consume(
          crypto.createHash('sha256').update(identity).digest('hex'),
          windowMs,
        )
      )));
      const current = buckets.reduce((mostLimited, bucket) => (
        bucket.count > mostLimited.count ? bucket : mostLimited
      ));
      if (current.count > max) {
        const retryAfter = Math.max(
          1,
          Math.ceil((new Date(current.resetAt).getTime() - Date.now()) / 1000),
        );
        res.setHeader('Retry-After', retryAfter);
        return res.status(429).json({ success: false, message });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = createRateLimit;
