const path = require('path');
const appConfig = require('./ung_dung.cau_hinh');

module.exports = {
  filename: process.env.DB_PATH || path.join(appConfig.projectRoot, 'data/motorcare.sqlite'),
  migrationsDirectory: path.join(__dirname, '../co_so_du_lieu/chuyen_doi'),
};
