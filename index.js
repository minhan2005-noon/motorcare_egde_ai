const express = require('express');

if (process.env.VERCEL
    && (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN)) {
  throw new Error(
    'Vercel cần TURSO_DATABASE_URL và TURSO_AUTH_TOKEN để đồng bộ dữ liệu giữa các phiên bản Function',
  );
}

const motorCareApp = require('./ma_nguon/may_chu/ung_dung');
const appConfig = require('./ma_nguon/may_chu/cau_hinh/ung_dung.cau_hinh');
const { initializeDatabase } = require('./ma_nguon/may_chu/co_so_du_lieu/ket_noi');
const { seedDatabase } = require('./ma_nguon/may_chu/co_so_du_lieu/tao_du_lieu_mau');

const app = express();
let initialization;

function initialize() {
  if (!initialization) {
    initialization = Promise.resolve()
      .then(() => initializeDatabase())
      .then(() => (
        appConfig.env === 'development'
          && process.env.SKIP_SEED !== '1'
          && process.env.DEMO_PASSWORD
          ? seedDatabase()
          : undefined
      ));
  }
  return initialization;
}

app.use(async (request, response, next) => {
  try {
    await initialize();
    next();
  } catch (error) {
    next(error);
  }
});

app.use(motorCareApp);

module.exports = app;
