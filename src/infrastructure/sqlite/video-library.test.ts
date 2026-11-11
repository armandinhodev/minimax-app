/** @vitest-environment node */

import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { migrateDatabase } from './schema';
import { SQLiteGenerationRepository } from './SQLiteGenerationRepository';

// The previous persisted schema, independent of the current migration implementation.
function legacyDatabase() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL);
    INSERT INTO schema_migrations VALUES (1, 'create_library_metadata', 1), (2, 'allow_local_file_assets', 2);
    CREATE TABLE generations (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('tts','music','image','clone','design')),
      source TEXT, status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('completed','failed','processing')),
      title TEXT, prompt TEXT, model TEXT, provider_generation_id TEXT, provider_task_id TEXT, provider_file_id TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE assets (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('audio','image','voice','metadata')),
      storage_type TEXT NOT NULL CHECK(storage_type IN ('provider_url','provider_file','local_file','browser_indexeddb','metadata_only')),
      storage_ref TEXT, format TEXT, mime_type TEXT, size_bytes INTEGER, expires_at INTEGER,
      metadata_json TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE generation_assets (
      generation_id TEXT NOT NULL, asset_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'primary',
      PRIMARY KEY(generation_id,asset_id),
      FOREIGN KEY(generation_id) REFERENCES generations(id) ON DELETE CASCADE,
      FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE
    );
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at INTEGER NOT NULL);
    INSERT INTO app_settings VALUES ('existing', '{"preserve":true}', 100);
  `);
  new SQLiteGenerationRepository(db).createGeneration({
    kind: 'music', source: 'cover-preprocess', title: 'Existing cover',
    prompt: 'Keep this prompt', metadata: { coverFeatureId: 'existing-feature', expiresAt: 123456 },
    assets: [{ kind: 'audio', storageType: 'local_file', storageRef: 'audio/existing.mp3', sizeBytes: 42 }],
  });
  return db;
}

function snapshot(db: Database.Database) {
  return ['generations', 'assets', 'generation_assets', 'app_settings'].map((table) => db.prepare(`SELECT * FROM ${table}`).all());
}

describe('video library migration and task recording', () => {
  it('preserves legacy data, links and foreign keys while allowing video, idempotently', () => {
    const db = legacyDatabase();
    try {
      const before = snapshot(db);
      migrateDatabase(db);
      migrateDatabase(db);
      expect(snapshot(db)).toEqual(before);
      expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
      expect(db.pragma('foreign_key_check')).toEqual([]);
      const repository = new SQLiteGenerationRepository(db);
      const video = repository.createGeneration({
        kind: 'video', source: 'video-generation', providerTaskId: 'task-new',
        assets: [{ kind: 'video', storageType: 'provider_url', storageRef: 'https://example.com/video.mp4' }],
      });
      expect(video.source).toBe('video-generation');
      expect(repository.getDashboardSummary(10).byKind.video).toBe(1);
      expect(repository.deleteGeneration(video.id)).toBe(true);
      expect(snapshot(db)).toEqual(before);
    } finally { db.close(); }
  });

  it('rolls back a migration with invalid existing links and restores foreign-key enforcement', () => {
    const db = legacyDatabase();
    try {
      db.pragma('foreign_keys = OFF');
      db.exec("INSERT INTO generation_assets VALUES ('missing', 'missing', 'primary')");
      db.pragma('foreign_keys = ON');
      const before = snapshot(db);
      expect(() => migrateDatabase(db)).toThrow();
      expect(snapshot(db)).toEqual(before);
      expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
      expect(db.prepare('SELECT version FROM schema_migrations WHERE version = 3').get()).toBeUndefined();
    } finally { db.close(); }
  });

  it('upserts each task once, refreshes its result URL and rejects stale status regression', () => {
    const db = new Database(':memory:');
    try {
      db.pragma('foreign_keys = ON');
      migrateDatabase(db);
      const repository = new SQLiteGenerationRepository(db);
      const queued = repository.upsertTaskGeneration({
        kind: 'video', source: 'video-generation', status: 'processing',
        providerTaskId: 'task-1', prompt: 'Original prompt', model: 'MiniMax-H3',
        metadata: { providerStatus: 'queued' },
      });
      const completed = repository.upsertTaskGeneration({
        kind: 'video', source: 'video-generation', status: 'completed', providerTaskId: 'task-1',
        metadata: { providerStatus: 'succeeded', providerUpdatedAt: 2000 },
        assets: [{ kind: 'video', storageType: 'provider_url', storageRef: 'https://example.com/first.mp4' }],
      });
      const refreshed = repository.upsertTaskGeneration({
        kind: 'video', source: 'video-generation', status: 'completed', providerTaskId: 'task-1',
        metadata: { providerStatus: 'succeeded', providerUpdatedAt: 2000 },
        assets: [{ kind: 'video', storageType: 'provider_url', storageRef: 'https://example.com/refreshed.mp4' }],
      });
      const stale = repository.upsertTaskGeneration({
        kind: 'video', source: 'video-generation', status: 'processing', providerTaskId: 'task-1',
        metadata: { providerStatus: 'running', providerUpdatedAt: 1000 },
      });
      expect(completed.id).toBe(queued.id);
      expect(refreshed.assets).toHaveLength(1);
      expect(refreshed.assets[0].id).toBe(completed.assets[0].id);
      expect(stale.status).toBe('completed');
      expect(stale.prompt).toBe('Original prompt');
      expect(stale.model).toBe('MiniMax-H3');
      expect(stale.assets[0].storageRef).toBe('https://example.com/refreshed.mp4');
      expect(repository.getDashboardSummary(10).totalGenerations).toBe(1);
    } finally { db.close(); }
  });

  it('does not change stored data when task recording is rejected', () => {
    const db = new Database(':memory:');
    try {
      migrateDatabase(db);
      const before = snapshot(db);
      const repository = new SQLiteGenerationRepository(db);
      expect(() => repository.upsertTaskGeneration({ kind: 'video', status: 'processing' })).toThrow();
      expect(snapshot(db)).toEqual(before);
    } finally { db.close(); }
  });
});
