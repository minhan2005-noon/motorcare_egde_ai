const path = require('path');
const express = require('express');

if (process.env.VERCEL && !process.env.DB_PATH) {
  process.env.DB_PATH = path.join('/tmp', 'motorcare.sqlite');
}

const motorCareApp = require('./ma_nguon/may_chu/ung_dung');
const { getDatabase } = require('./ma_nguon/may_chu/co_so_du_lieu/ket_noi');
const { seedDatabase } = require('./ma_nguon/may_chu/co_so_du_lieu/tao_du_lieu_mau');

const app = express();
let initialization;

function initialize() {
  if (!initialization) {
    initialization = Promise.resolve()
      .then(() => getDatabase())
      .then(() => (process.env.SKIP_SEED === '1' ? undefined : seedDatabase()));
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
