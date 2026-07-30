const path = require('path');

const projectRoot = path.resolve(__dirname, '../../..');
require('dotenv').config({ path: path.join(projectRoot, '.env'), quiet: true });

const smtpPort = Number(process.env.SMTP_PORT) || 587;

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  projectRoot,
  webRoot: path.join(projectRoot, 'ma_nguon/giao_dien'),
  sessionCookieName: 'motorcare_session',
  sessionDays: Number(process.env.SESSION_DAYS) || 7,
  resetTokenMinutes: Number(process.env.RESET_TOKEN_MINUTES) || 15,
  email: {
    service: process.env.SMTP_SERVICE || '',
    host: process.env.SMTP_HOST || '',
    port: smtpPort,
    secure: process.env.SMTP_SECURE === '1' || smtpPort === 465,
    user: process.env.SMTP_USER || '',
    pass: (process.env.SMTP_PASS || '').replace(/\s/g, ''),
    from: process.env.MAIL_FROM || process.env.SMTP_USER || '',
  },
  isProduction: process.env.NODE_ENV === 'production',
};
