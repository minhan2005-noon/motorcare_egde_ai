const app = require('./ung_dung');
const appConfig = require('./cau_hinh/ung_dung.cau_hinh');
const { getDatabase, closeDatabase } = require('./co_so_du_lieu/ket_noi');
const { seedDatabase } = require('./co_so_du_lieu/tao_du_lieu_mau');

async function startServer() {
  getDatabase();

  if (appConfig.env !== 'test' && process.env.SKIP_SEED !== '1') {
    await seedDatabase();
  }

  const server = app.listen(appConfig.port, () => {
    console.log(`MotorCare Edge AI đang chạy tại http://localhost:${appConfig.port}`);
  });

  function shutdown(signal) {
    console.log(`\nNhận ${signal}, đang đóng server...`);
    server.close(() => {
      closeDatabase();
      process.exit(0);
    });
  }

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  return server;
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Không thể khởi động server:', error);
    process.exit(1);
  });
}

module.exports = { startServer };
