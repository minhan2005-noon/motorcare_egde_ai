const crypto = require('crypto');

function createOpaqueToken(byteLength = 32) {
  return crypto.randomBytes(byteLength).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createNumericCode(length = 6) {
  const minimum = 10 ** (length - 1);
  const maximum = 10 ** length;
  return crypto.randomInt(minimum, maximum).toString();
}

function tokenMatches(token, expectedHash) {
  const tokenHash = Buffer.from(hashToken(token), 'hex');
  const storedHash = Buffer.from(String(expectedHash || ''), 'hex');
  return tokenHash.length === storedHash.length
    && crypto.timingSafeEqual(tokenHash, storedHash);
}

function expiresIn({ days = 0, minutes = 0 }) {
  const milliseconds = (days * 24 * 60 + minutes) * 60 * 1000;
  return new Date(Date.now() + milliseconds).toISOString();
}

module.exports = {
  createOpaqueToken,
  createNumericCode,
  hashToken,
  tokenMatches,
  expiresIn,
};
