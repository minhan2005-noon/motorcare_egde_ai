const {
  initializeDatabase,
  getDatabaseStatus,
  closeDatabase,
} = require('../ma_nguon/may_chu/co_so_du_lieu/ket_noi');

async function main() {
  await initializeDatabase();
  const status = await getDatabaseStatus();
  console.log(JSON.stringify(status, null, 2));
  if (!status.ready) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('Không thể kiểm tra cơ sở dữ liệu:', error);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
