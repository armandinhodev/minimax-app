/** @vitest-environment node */

import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { SQLiteGenerationRepository } from './SQLiteGenerationRepository';
import { closeDatabaseConnection, getDatabase, migrateDatabase } from './schema';

describe('SQLiteGenerationRepository', () => {
  beforeEach(() => {
    process.env.MINIMAX_SQLITE_PATH = path.join(os.tmpdir(), `minimax-test-${Date.now()}-${Math.random()}.sqlite`);
    closeDatabaseConnection();
  });

  afterEach(() => {
    closeDatabaseConnection();
    delete process.env.MINIMAX_SQLITE_PATH;
  });

  it('runs migrations idempotently and creates expected indexes', () => {
    const db = getDatabase();

    migrateDatabase(db);
    migrateDatabase(db);

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all() as Array<{ name: string }>;

    expect(tables.map((row) => row.name)).toEqual(expect.arrayContaining([
      'schema_migrations',
      'generations',
      'assets',
      'generation_assets',
      'app_settings',
    ]));
    expect(indexes.map((row) => row.name)).toEqual(expect.arrayContaining([
      'idx_generations_created_at',
      'idx_generations_kind_created_at',
      'idx_generations_status_created_at',
      'idx_assets_kind_created_at',
    ]));
  });

  it('stores generation metadata and asset references without binary payloads', () => {
    const repository = new SQLiteGenerationRepository();
    const created = repository.createGeneration({
      kind: 'image',
      source: 'text-to-image',
      prompt: 'A premium product photo.',
      model: 'image-01',
      providerGenerationId: 'generation-1',
      metadata: { aspectRatio: '16:9', seed: 42 },
      assets: [
        {
          kind: 'audio',
          storageType: 'local_file',
          storageRef: 'audio/generation-1.mp3',
          format: 'mp3',
          mimeType: 'audio/mpeg',
          sizeBytes: 4,
        },
      ],
    });

    const summary = repository.getDashboardSummary(5);

    expect(created.assets).toHaveLength(1);
    expect(created.assets[0].storageType).toBe('local_file');
    expect(created.assets[0].storageRef).toBe('audio/generation-1.mp3');
    expect(summary.totalGenerations).toBe(1);
    expect(summary.totalAssets).toBe(1);
    expect(summary.byKind.image).toBe(1);
    expect(summary.recentGenerations[0].prompt).toBe('A premium product photo.');
    expect(JSON.stringify(summary)).not.toContain('00010203');
  });

  it('uses cascading deletes for generation asset links', () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    migrateDatabase(db);
    const repository = new SQLiteGenerationRepository(db);
    const created = repository.createGeneration({
      kind: 'music',
      source: 'text-to-music',
      prompt: 'Glossy synth-pop.',
      assets: [{ kind: 'audio', storageType: 'metadata_only', format: 'mp3' }],
    });

    expect(repository.deleteGeneration(created.id)).toBe(true);

    const generationCount = (db.prepare('SELECT COUNT(*) AS count FROM generations').get() as { count: number }).count;
    const assetCount = (db.prepare('SELECT COUNT(*) AS count FROM assets').get() as { count: number }).count;
    const linkCount = (db.prepare('SELECT COUNT(*) AS count FROM generation_assets').get() as { count: number }).count;

    expect(generationCount).toBe(0);
    expect(assetCount).toBe(0);
    expect(linkCount).toBe(0);
    db.close();
  });

  it('preserves cover preprocess source records', () => {
    const repository = new SQLiteGenerationRepository();
    const created = repository.createGeneration({
      kind: 'music',
      source: 'cover-preprocess',
      title: 'Cover preprocess',
      providerGenerationId: 'cover-feature-1',
      metadata: { coverFeatureId: 'cover-feature-1', expiresAt: Date.now() + 86_400_000 },
      assets: [{ kind: 'metadata', storageType: 'metadata_only', role: 'cover_feature' }],
    });

    expect(created.source).toBe('cover-preprocess');
    expect(created.assets[0].kind).toBe('metadata');
    expect(created.assets[0].storageType).toBe('metadata_only');
  });

  it('round-trips a Video Agent task and keeps its prompt and template through status updates', () => {
    const repository = new SQLiteGenerationRepository();
    repository.upsertTaskGeneration({
      kind: 'video', source: 'video-agent', providerTaskId: 'agent-1', prompt: 'A product film',
      status: 'processing',
      metadata: { providerStatus: 'preparing', taskType: 'video-agent', templateId: '394176968202485769' },
      assets: [],
    });

    const finished = repository.upsertTaskGeneration({
      kind: 'video', source: 'video-agent', providerTaskId: 'agent-1', status: 'completed',
      metadata: { providerStatus: 'succeeded' },
      assets: [{
        kind: 'video', storageType: 'provider_url', storageRef: 'https://example.com/agent.mp4',
        format: 'mp4', mimeType: 'video/mp4', metadata: { temporaryUrl: true },
      }],
    });

    expect(finished.source).toBe('video-agent');
    expect(finished.prompt).toBe('A product film');
    expect(finished.metadata.templateId).toBe('394176968202485769');
    expect(finished.metadata.providerStatus).toBe('succeeded');
    expect(finished.assets).toHaveLength(1);
    expect(finished.assets[0].storageRef).toBe('https://example.com/agent.mp4');

    // A late poll must not downgrade a finished task back to processing.
    const stale = repository.upsertTaskGeneration({
      kind: 'video', source: 'video-agent', providerTaskId: 'agent-1', status: 'processing',
      metadata: { providerStatus: 'processing' }, assets: [],
    });
    expect(stale.status).toBe('completed');
    expect(stale.assets).toHaveLength(1);
  });
});
