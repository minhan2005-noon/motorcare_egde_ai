const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const databaseConfig = require('../cau_hinh/co_so_du_lieu.cau_hinh');

let database;

function ensureDatabaseDirectory() {
  if (databaseConfig.filename === ':memory:') {
    return;
  }

  fs.mkdirSync(path.dirname(databaseConfig.filename), { recursive: true });
}

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const files = fs
    .readdirSync(databaseConfig.migrationsDirectory)
    .filter((filename) => filename.endsWith('.sql'))
    .sort();

  const hasMigration = db.prepare(
    'SELECT 1 FROM schema_migrations WHERE filename = ? OR filename LIKE ? LIMIT 1',
  );
  const recordMigration = db.prepare(
    'INSERT INTO schema_migrations (filename, applied_at) VALUES (?, ?)',
  );

  for (const filename of files) {
    const migrationNumber = filename.match(/^\d+/)?.[0];
    if (hasMigration.get(filename, `${migrationNumber}_%`)) {
      continue;
    }

    const sql = fs.readFileSync(
      path.join(databaseConfig.migrationsDirectory, filename),
      'utf8',
    );

    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(sql);
      recordMigration.run(filename, new Date().toISOString());
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}

function getDatabase() {
  if (database) {
    return database;
  }

  ensureDatabaseDirectory();
  database = new DatabaseSync(databaseConfig.filename);
  database.exec('PRAGMA foreign_keys = ON');
  database.exec('PRAGMA busy_timeout = 5000');

  if (databaseConfig.filename !== ':memory:') {
    database.exec('PRAGMA journal_mode = WAL');
  }

  runMigrations(database);
  return database;
}

function closeDatabase() {
  if (database) {
    database.close();
    database = undefined;
  }
}

module.exports = {
  getDatabase,
  closeDatabase,
  runMigrations,
};
