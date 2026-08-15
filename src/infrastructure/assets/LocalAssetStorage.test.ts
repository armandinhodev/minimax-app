/** @vitest-environment node */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

describe('LocalAssetStorage', () => {
  let temporaryDirectory: string;

  beforeEach(async () => {
    temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'minimax-assets-'));
    process.env.MINIMAX_ASSETS_DIR = temporaryDirectory;
  });

  afterEach(async () => {
    delete process.env.MINIMAX_ASSETS_DIR;
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
    vi.resetModules();
  });

  it('decodes hex and base64 asset payloads', async () => {
    const { decodeAssetPayload } = await import('./LocalAssetStorage');

    expect([...decodeAssetPayload('00010203')]).toEqual([0, 1, 2, 3]);
    expect(decodeAssetPayload(Buffer.from('audio').toString('base64')).toString()).toBe('audio');
    expect(decodeAssetPayload(`data:audio/mpeg;base64,${Buffer.from('clip').toString('base64')}`).toString()).toBe('clip');
  });

  it('stores files under the configured assets directory with a relative storage ref', async () => {
    const { readLocalAsset, writeLocalAsset } = await import('./LocalAssetStorage');

    const storedAsset = await writeLocalAsset({ kind: 'audio', bytes: Buffer.from([0, 1, 2, 3]), format: 'mp3' });
    const file = await readLocalAsset(storedAsset.storageRef);

    expect(storedAsset).toMatchObject({ storageType: 'local_file', sizeBytes: 4 });
    expect(storedAsset.storageRef).toMatch(/^audio\//);
    expect(path.isAbsolute(storedAsset.storageRef)).toBe(false);
    expect(file.absolutePath.startsWith(temporaryDirectory)).toBe(true);
    expect([...file.bytes]).toEqual([0, 1, 2, 3]);
  });

  it('rejects path traversal refs and deletes missing files idempotently', async () => {
    const { deleteLocalAsset, readLocalAsset } = await import('./LocalAssetStorage');

    await expect(readLocalAsset('../outside.mp3')).rejects.toThrow('Invalid local asset storage reference');
    await expect(deleteLocalAsset('audio/missing.mp3')).resolves.toBeUndefined();
  });
});
