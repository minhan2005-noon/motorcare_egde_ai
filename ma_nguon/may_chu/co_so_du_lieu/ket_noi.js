const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { createClient } = require('@libsql/client');
const databaseConfig = require('../cau_hinh/co_so_du_lieu.cau_hinh');

let database;
let initialization;

function ensureDatabaseDirectory() {
  if (databaseConfig.filename === ':memory:' || databaseConfig.usesTurso) return;
  fs.mkdirSync(path.dirname(databaseConfig.filename), { recursive: true });
}

function migrationFiles() {
  return fs
    .readdirSync(databaseConfig.migrationsDirectory)
    .filter((filename) => filename.endsWith('.sql'))
    .sort();
}

function runLocalMigrations(client) {
  client.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const hasMigration = client.prepare(
    'SELECT 1 FROM schema_migrations WHERE filename = ? OR filename LIKE ? LIMIT 1',
  );
  const recordMigration = client.prepare(
    'INSERT INTO schema_migrations (filename, applied_at) VALUES (?, ?)',
  );

  for (const filename of migrationFiles()) {
    const migrationNumber = filename.match(/^\d+/)?.[0];
    if (hasMigration.get(filename, `${migrationNumber}_%`)) continue;
    const sql = fs.readFileSync(
      path.join(databaseConfig.migrationsDirectory, filename),
      'utf8',
    );

    client.exec('BEGIN IMMEDIATE');
    try {
      client.exec(sql);
      recordMigration.run(filename, new Date().toISOString());
      client.exec('COMMIT');
    } catch (error) {
      client.exec('ROLLBACK');
      throw error;
    }
  }
}

function localAdapter() {
  ensureDatabaseDirectory();
  const client = new DatabaseSync(databaseConfig.filename);
  client.exec('PRAGMA foreign_keys = ON');
  client.exec('PRAGMA busy_timeout = 5000');
  if (databaseConfig.filename !== ':memory:') client.exec('PRAGMA journal_mode = WAL');
  runLocalMigrations(client);

  return {
    kind: 'sqlite',
    prepare(sql) {
      const statement = client.prepare(sql);
      return {
        run: async (...args) => statement.run(...args),
        get: async (...args) => statement.get(...args),
        all: async (...args) => statement.all(...args),
      };
    },
    exec: async (sql) => client.exec(sql),
    migrate: async (sql, filename, appliedAt) => {
      client.exec('BEGIN IMMEDIATE');
      try {
        client.exec(sql);
        client.prepare(
          'INSERT INTO schema_migrations (filename, applied_at) VALUES (?, ?)',
        ).run(filename, appliedAt);
        client.exec('COMMIT');
      } catch (error) {
        client.exec('ROLLBACK');
        throw error;
      }
    },
    close: async () => client.close(),
  };
}

function tursoAdapter() {
  const client = createClient({
    url: databaseConfig.tursoUrl,
    authToken: databaseConfig.tursoAuthToken,
  });

  return {
    kind: 'turso',
    prepare(sql) {
      return {
        run: async (...args) => {
          const result = await client.execute({ sql, args });
          return {
            changes: result.rowsAffected,
            lastInsertRowid: result.lastInsertRowid,
          };
        },
        get: async (...args) => (await client.execute({ sql, args })).rows[0],
        all: async (...args) => (await client.execute({ sql, args })).rows,
      };
    },
    exec: async (sql) => client.executeMultiple(sql),
    migrate: async (sql, filename, appliedAt) => {
      const escapedFilename = filename.replaceAll("'", "''");
      const escapedAppliedAt = appliedAt.replaceAll("'", "''");
      await client.executeMultiple(`
        BEGIN;
        ${sql}
        INSERT INTO schema_migrations (filename, applied_at)
        VALUES ('${escapedFilename}', '${escapedAppliedAt}');
        COMMIT;
      `);
    },
    close: async () => client.close(),
  };
}

function getDatabase() {
  if (!database) database = databaseConfig.usesTurso ? tursoAdapter() : localAdapter();
  return database;
}

async function runMigrations(db = getDatabase()) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const hasMigration = db.prepare(
    'SELECT 1 FROM schema_migrations WHERE filename = ? OR filename LIKE ? LIMIT 1',
  );

  for (const filename of migrationFiles()) {
    const migrationNumber = filename.match(/^\d+/)?.[0];
    if (await hasMigration.get(filename, `${migrationNumber}_%`)) continue;
    const sql = fs.readFileSync(
      path.join(databaseConfig.migrationsDirectory, filename),
      'utf8',
    );
    await db.migrate(sql, filename, new Date().toISOString());
  }
}

async function initializeDatabase() {
  if (!initialization) {
    initialization = runMigrations(getDatabase()).catch((error) => {
      initialization = undefined;
      throw error;
    });
  }
  await initialization;
  return getDatabase();
}

async function closeDatabase() {
  if (!database) return;
  await database.close();
  database = undefined;
  initialization = undefined;
}

module.exports = {
  getDatabase,
  initializeDatabase,
  closeDatabase,
  runMigrations,
};
