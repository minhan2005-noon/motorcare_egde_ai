const appConfig = require('./ung_dung.cau_hinh');

function corsMiddleware(req, res, next) {
  const origin = req.get('origin');
  const allowedOrigins = new Set(
    (process.env.ALLOWED_ORIGINS || `http://localhost:${appConfig.port}`)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );

  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Transport');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
}

module.exports = corsMiddleware;
