const appConfig = require('../cau_hinh/ung_dung.cau_hinh');

function parseCookies(req) {
  const header = req.get('cookie') || '';

  return header.split(';').reduce((cookies, item) => {
    const separator = item.indexOf('=');
    if (separator === -1) {
      return cookies;
    }

    const key = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();

    if (key) {
      cookies[key] = decodeURIComponent(value);
    }

    return cookies;
  }, {});
}

function sessionCookie(token, expiresAt) {
  const parts = [
    `${appConfig.sessionCookieName}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Expires=${new Date(expiresAt).toUTCString()}`,
  ];

  if (appConfig.isProduction) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function expiredSessionCookie() {
  const parts = [
    `${appConfig.sessionCookieName}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];

  if (appConfig.isProduction) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

module.exports = {
  parseCookies,
  sessionCookie,
  expiredSessionCookie,
};
