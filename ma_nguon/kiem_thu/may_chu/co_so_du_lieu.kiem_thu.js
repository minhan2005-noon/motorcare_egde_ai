const test = require('node:test');
const assert = require('node:assert/strict');
const {
  initializeDatabase,
  getDatabase,
  getDatabaseStatus,
} = require('../../may_chu/co_so_du_lieu/ket_noi');

test('database migrations create the complete runtime schema', async () => {
  await initializeDatabase();
  const status = await getDatabaseStatus();
  assert.equal(status.ready, true);
  assert.equal(status.appliedMigrations, status.expectedMigrations);
  assert.equal(status.latestMigration, '013_tao_gioi_han_tan_suat.sql');

  const tables = await getDatabase().prepare(`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();
  const names = tables.map((row) => row.name);
  for (const table of [
    'users', 'sessions', 'password_reset_tokens', 'motors',
    'sensor_readings', 'alerts', 'calibrations', 'user_settings',
    'audit_logs', 'rate_limit_buckets', 'schema_migrations',
  ]) {
    assert.ok(names.includes(table), `missing table ${table}`);
  }

  const settingColumns = await getDatabase().prepare(
    'PRAGMA table_info(user_settings)',
  ).all();
  assert.equal(settingColumns.some((column) => column.name === 'enable_3d'), false);
});
