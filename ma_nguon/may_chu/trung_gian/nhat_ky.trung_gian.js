const auditRepository = require('../kho_du_lieu/nhat_ky.kho_du_lieu');

const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function auditMiddleware(req, res, next) {
  if (!mutatingMethods.has(req.method)) return next();
  const route = `${req.baseUrl}${req.path}`;
  const segments = req.path.split('/').filter(Boolean);

  res.once('finish', () => {
    if (!req.user || res.statusCode >= 400 || req.path === '/devices/readings') return;
    auditRepository.record({
      userId: req.user.id,
      action: `${req.method} ${route}`,
      entityType: segments[0] || 'api',
      entityId: segments[1] || null,
      metadata: { statusCode: res.statusCode, requestId: res.locals.requestId },
      ipAddress: req.ip,
    }).catch((error) => {
      console.error('Không thể ghi audit log:', error.message);
    });
  });

  return next();
}

module.exports = auditMiddleware;
