/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LibraryGenerationDTO } from '@/application/dto/LibraryDTO';

vi.mock('server-only', () => ({}));

const { findGenerationMock, readLocalAssetMock } = vi.hoisted(() => ({
  findGenerationMock: vi.fn(),
  readLocalAssetMock: vi.fn(),
}));

vi.mock('@/infrastructure/sqlite/SQLiteGenerationRepository', () => ({
  SQLiteGenerationRepository: vi.fn().mockImplementation(() => ({
    findGeneration: findGenerationMock,
  })),
}));

vi.mock('@/infrastructure/assets/LocalAssetStorage', () => ({
  readLocalAsset: readLocalAssetMock,
}));

function createGeneration(): LibraryGenerationDTO {
  return {
    id: 'generation-1',
    kind: 'tts',
    source: 'text-to-speech',
    status: 'completed',
    title: null,
    prompt: 'Hello',
    model: 'speech-2.8-hd',
    providerGenerationId: null,
    providerTaskId: null,
    providerFileId: null,
    metadata: {},
    assets: [{
      id: 'asset-1',
      kind: 'audio',
      storageType: 'local_file',
      storageRef: 'audio/generation-1.mp3',
      format: 'mp3',
      mimeType: 'audio/mpeg',
      sizeBytes: 4,
      expiresAt: null,
      metadata: {},
      createdAt: 1,
    }],
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('GET /api/library/generations/[generationId]/assets/[assetId]', () => {
  beforeEach(() => {
    process.env.APP_ACCESS_KEY = 'test-key';
    findGenerationMock.mockReset();
    readLocalAssetMock.mockReset();
  });

  it('requires app auth', async () => {
    const { GET } = await import('./route');

    const response = await GET(new Request('http://localhost/api/library/generations/generation-1/assets/asset-1'), {
      params: Promise.resolve({ generationId: 'generation-1', assetId: 'asset-1' }),
    });

    expect(response.status).toBe(401);
  });

  it('returns a local file asset with download headers', async () => {
    const { GET } = await import('./route');
    findGenerationMock.mockReturnValue(createGeneration());
    readLocalAssetMock.mockResolvedValue({ bytes: Buffer.from([0, 1, 2, 3]), absolutePath: 'asset.mp3' });

    const response = await GET(new Request('http://localhost/api/library/generations/generation-1/assets/asset-1', {
      headers: { Authorization: 'Bearer test-key' },
    }), {
      params: Promise.resolve({ generationId: 'generation-1', assetId: 'asset-1' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(response.headers.get('Content-Disposition')).toContain('minimax-audio-generati.mp3');
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([0, 1, 2, 3]);
  });

  it('redirects safe provider URL assets', async () => {
    const { GET } = await import('./route');
    findGenerationMock.mockReturnValue({
      ...createGeneration(),
      assets: [{
        id: 'asset-1',
        kind: 'image',
        storageType: 'provider_url',
        storageRef: 'https://example.com/image.png',
        format: 'png',
        mimeType: 'image/png',
        sizeBytes: null,
        expiresAt: null,
        metadata: {},
        createdAt: 1,
      }],
    });

    const response = await GET(new Request('http://localhost/api/library/generations/generation-1/assets/asset-1', {
      headers: { Authorization: 'Bearer test-key' },
    }), {
      params: Promise.resolve({ generationId: 'generation-1', assetId: 'asset-1' }),
    });

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://example.com/image.png');
  });
});
