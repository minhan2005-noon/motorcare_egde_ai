const path = require('path');
const appConfig = require('./ung_dung.cau_hinh');

const tursoUrl = process.env.TURSO_DATABASE_URL || '';
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN || '';

if ((tursoUrl && !tursoAuthToken) || (!tursoUrl && tursoAuthToken)) {
  throw new Error('Cần khai báo đồng thời TURSO_DATABASE_URL và TURSO_AUTH_TOKEN');
}

module.exports = {
  filename: process.env.DB_PATH || path.join(appConfig.projectRoot, 'data/motorcare.sqlite'),
  migrationsDirectory: path.join(__dirname, '../co_so_du_lieu/chuyen_doi'),
  usesTurso: Boolean(tursoUrl && tursoAuthToken),
  tursoUrl,
  tursoAuthToken,
};
