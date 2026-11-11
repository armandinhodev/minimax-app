import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

type DatabaseConnection = Database.Database;

interface Migration {
  version: number;
  name: string;
  sql?: string;
  up?: (db: DatabaseConnection) => void;
}

const DEFAULT_DATABASE_PATH = path.join(process.cwd(), 'data', 'minimax.sqlite');

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'create_library_metadata',
    sql: `
      CREATE TABLE IF NOT EXISTS generations (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL CHECK (kind IN ('tts', 'music', 'image', 'clone', 'design')),
        source TEXT,
        status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'processing')),
        title TEXT,
        prompt TEXT,
        model TEXT,
        provider_generation_id TEXT,
        provider_task_id TEXT,
        provider_file_id TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL CHECK (kind IN ('audio', 'image', 'voice', 'metadata')),
        storage_type TEXT NOT NULL CHECK (storage_type IN ('provider_url', 'provider_file', 'local_file', 'browser_indexeddb', 'metadata_only')),
        storage_ref TEXT,
        format TEXT,
        mime_type TEXT,
        size_bytes INTEGER,
        expires_at INTEGER,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS generation_assets (
        generation_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'primary',
        PRIMARY KEY (generation_id, asset_id),
        FOREIGN KEY (generation_id) REFERENCES generations(id) ON DELETE CASCADE,
        FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_generations_kind_created_at ON generations(kind, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_generations_status_created_at ON generations(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_assets_kind_created_at ON assets(kind, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_assets_expires_at ON assets(expires_at);
      CREATE INDEX IF NOT EXISTS idx_generation_assets_asset_id ON generation_assets(asset_id);
    `,
  },
  {
    version: 2,
    name: 'allow_local_file_assets',
    up: (db) => {
      const wasForeignKeysEnabled = db.pragma('foreign_keys', { simple: true }) === 1;
      db.pragma('foreign_keys = OFF');

      try {
        db.transaction(() => {
          db.exec(`
            CREATE TABLE assets_next (
              id TEXT PRIMARY KEY,
              kind TEXT NOT NULL CHECK (kind IN ('audio', 'image', 'voice', 'metadata')),
              storage_type TEXT NOT NULL CHECK (storage_type IN ('provider_url', 'provider_file', 'local_file', 'browser_indexeddb', 'metadata_only')),
              storage_ref TEXT,
              format TEXT,
              mime_type TEXT,
              size_bytes INTEGER,
              expires_at INTEGER,
              metadata_json TEXT NOT NULL DEFAULT '{}',
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL
            );

            INSERT INTO assets_next (
              id, kind, storage_type, storage_ref, format, mime_type, size_bytes,
              expires_at, metadata_json, created_at, updated_at
            )
            SELECT
              id, kind, storage_type, storage_ref, format, mime_type, size_bytes,
              expires_at, metadata_json, created_at, updated_at
            FROM assets;

            DROP TABLE assets;
            ALTER TABLE assets_next RENAME TO assets;
            CREATE INDEX IF NOT EXISTS idx_assets_kind_created_at ON assets(kind, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_assets_expires_at ON assets(expires_at);
          `);
        })();
      } finally {
        if (wasForeignKeysEnabled) db.pragma('foreign_keys = ON');
      }
    },
  },
  {
    version: 3,
    name: 'allow_video_generations_and_assets',
    up: (db) => {
      const wasForeignKeysEnabled = db.pragma('foreign_keys', { simple: true }) === 1;
      db.pragma('foreign_keys = OFF');
      try {
        db.transaction(() => {
          db.exec(`
            CREATE TABLE generations_video (
              id TEXT PRIMARY KEY,
              kind TEXT NOT NULL CHECK (kind IN ('tts', 'music', 'image', 'video', 'clone', 'design')),
              source TEXT,
              status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'processing')),
              title TEXT, prompt TEXT, model TEXT,
              provider_generation_id TEXT, provider_task_id TEXT, provider_file_id TEXT,
              metadata_json TEXT NOT NULL DEFAULT '{}',
              created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
            );
            INSERT INTO generations_video SELECT * FROM generations;

            CREATE TABLE assets_video (
              id TEXT PRIMARY KEY,
              kind TEXT NOT NULL CHECK (kind IN ('audio', 'image', 'video', 'voice', 'metadata')),
              storage_type TEXT NOT NULL CHECK (storage_type IN ('provider_url', 'provider_file', 'local_file', 'browser_indexeddb', 'metadata_only')),
              storage_ref TEXT, format TEXT, mime_type TEXT, size_bytes INTEGER, expires_at INTEGER,
              metadata_json TEXT NOT NULL DEFAULT '{}',
              created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
            );
            INSERT INTO assets_video SELECT * FROM assets;

            DROP TABLE generations;
            ALTER TABLE generations_video RENAME TO generations;
            DROP TABLE assets;
            ALTER TABLE assets_video RENAME TO assets;
            CREATE INDEX idx_generations_created_at ON generations(created_at DESC);
            CREATE INDEX idx_generations_kind_created_at ON generations(kind, created_at DESC);
            CREATE INDEX idx_generations_status_created_at ON generations(status, created_at DESC);
            CREATE UNIQUE INDEX idx_video_provider_task ON generations(provider_task_id)
              WHERE kind = 'video' AND provider_task_id IS NOT NULL;
            CREATE INDEX idx_assets_kind_created_at ON assets(kind, created_at DESC);
            CREATE INDEX idx_assets_expires_at ON assets(expires_at);
          `);
          if (db.pragma('foreign_key_check').length > 0) {
            throw new Error('Library migration refused: existing asset links are invalid.');
          }
        })();
      } finally {
        if (wasForeignKeysEnabled) db.pragma('foreign_keys = ON');
      }
    },
  },
];

let connection: DatabaseConnection | null = null;
let connectionPath: string | null = null;

export function getDatabasePath(): string {
  const configuredPath = process.env.MINIMAX_SQLITE_PATH?.trim();
  if (configuredPath) return path.resolve(configuredPath);
  if (process.env.VITEST) return ':memory:';

  return DEFAULT_DATABASE_PATH;
}

function ensureDatabaseDirectory(databasePath: string): void {
  if (databasePath === ':memory:') return;
  const directory = path.dirname(databasePath);
  fs.mkdirSync(directory, { recursive: true });
}

function ensureMigrationTable(db: DatabaseConnection): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);
}

export function migrateDatabase(db: DatabaseConnection): void {
  ensureMigrationTable(db);
  const applied = db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: number }>;
  const appliedVersions = new Set(applied.map((row) => row.version));

  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) continue;

    if (migration.up) {
      migration.up(db);
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
        .run(migration.version, migration.name, Date.now());
    } else if (migration.sql) {
      const sql = migration.sql;
      const applyMigration = db.transaction(() => {
        db.exec(sql);
        db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
          .run(migration.version, migration.name, Date.now());
      });

      applyMigration();
    }
  }
}

export function getDatabase(): DatabaseConnection {
  const databasePath = getDatabasePath();
  if (connection && connectionPath === databasePath) return connection;

  connection?.close();
  ensureDatabaseDirectory(databasePath);
  connection = new Database(databasePath);
  connection.pragma('foreign_keys = ON');
  migrateDatabase(connection);
  connectionPath = databasePath;

  return connection;
}

export function closeDatabaseConnection(): void {
  connection?.close();
  connection = null;
  connectionPath = null;
}
