const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;
const SCRYPT_COST = 16384;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derivedKey = await scrypt(password, salt, KEY_LENGTH, {
    N: SCRYPT_COST,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });

  return [
    'scrypt',
    SCRYPT_COST,
    salt.toString('hex'),
    Buffer.from(derivedKey).toString('hex'),
  ].join(':');
}

async function verifyPassword(password, storedHash) {
  if (typeof storedHash !== 'string') {
    return false;
  }

  const [algorithm, cost, saltHex, originalHash] = storedHash.split(':');
  if (algorithm !== 'scrypt' || !cost || !saltHex || !originalHash) {
    return false;
  }

  const derivedKey = await scrypt(password, Buffer.from(saltHex, 'hex'), KEY_LENGTH, {
    N: Number(cost),
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  const candidate = Buffer.from(derivedKey);
  const expected = Buffer.from(originalHash, 'hex');

  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

module.exports = {
  hashPassword,
  verifyPassword,
};
