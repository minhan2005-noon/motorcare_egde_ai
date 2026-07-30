const userRepository = require('../kho_du_lieu/nguoi_dung.kho_du_lieu');
const sessionRepository = require('../kho_du_lieu/phien.kho_du_lieu');
const { hashToken } = require('../tien_ich/ma_xac_thuc');
const { parseCookies } = require('../tien_ich/cookie');
const appConfig = require('../cau_hinh/ung_dung.cau_hinh');

function extractToken(req) {
  const header = req.get('authorization') || '';
  const [scheme, bearerToken] = header.split(' ');
  if (scheme === 'Bearer' && bearerToken) {
    return bearerToken;
  }
  return parseCookies(req)[appConfig.sessionCookieName] || null;
}

async function authenticate(req) {
  const token = extractToken(req);
  if (!token) {
    return null;
  }

  const session = await sessionRepository.findValidByTokenHash(hashToken(token));
  if (!session) {
    return null;
  }

  const user = await userRepository.findPublicById(session.userId);
  if (!user || !user.isActive) {
    return null;
  }

  return { token, session, user };
}

async function loadAuth(req, res, next) {
  try {
    const auth = await authenticate(req);
    if (auth) {
      req.authToken = auth.token;
      req.authSession = auth.session;
      req.user = auth.user;
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

async function requireAuth(req, res, next) {
  try {
    const auth = req.user ? {
      token: req.authToken,
      session: req.authSession,
      user: req.user,
    } : await authenticate(req);

    if (!auth) {
      return res.status(401).json({
        success: false,
        message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn',
        requestId: res.locals.requestId,
      });
    }

    req.authToken = auth.token;
    req.authSession = auth.session;
    req.user = auth.user;
    return next();
  } catch (error) {
    return next(error);
  }
}

function requirePageAuth(req, res, next) {
  if (!req.user) {
    const returnTo = encodeURIComponent(req.originalUrl);
    return res.redirect(`/login?returnTo=${returnTo}`);
  }
  return next();
}

function redirectIfAuthenticated(req, res, next) {
  if (req.user) {
    return res.redirect('/dashboard');
  }
  return next();
}

module.exports = {
  extractToken,
  authenticate,
  loadAuth,
  requireAuth,
  requirePageAuth,
  redirectIfAuthenticated,
};
