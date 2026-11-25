/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { deleteGenerationMock, deleteLocalAssetMock, findGenerationMock } = vi.hoisted(() => ({
  deleteGenerationMock: vi.fn(),
  deleteLocalAssetMock: vi.fn(),
  findGenerationMock: vi.fn(),
}));

vi.mock('@/infrastructure/sqlite/SQLiteGenerationRepository', () => ({
  SQLiteGenerationRepository: vi.fn().mockImplementation(() => ({
    deleteGeneration: deleteGenerationMock,
    findGeneration: findGenerationMock,
  })),
}));

vi.mock('@/infrastructure/assets/LocalAssetStorage', () => ({
  deleteLocalAsset: deleteLocalAssetMock,
}));

describe('/api/library/generations/[generationId]', () => {
  beforeEach(() => {
    process.env.APP_ACCESS_KEY = 'test-key';
    deleteGenerationMock.mockReset();
    deleteLocalAssetMock.mockReset();
    findGenerationMock.mockReset();
  });

  it('requires app auth', async () => {
    const { DELETE } = await import('./route');

    const response = await DELETE(new Request('http://localhost/api/library/generations/generation-1', { method: 'DELETE' }), {
      params: Promise.resolve({ generationId: 'generation-1' }),
    });

    expect(response.status).toBe(401);
    expect(deleteGenerationMock).not.toHaveBeenCalled();
  });

  it('requires app auth for generation detail reads', async () => {
    const { GET } = await import('./route');

    const response = await GET(new Request('http://localhost/api/library/generations/generation-1'), {
      params: Promise.resolve({ generationId: 'generation-1' }),
    });

    expect(response.status).toBe(401);
    expect(findGenerationMock).not.toHaveBeenCalled();
  });

  it('returns a generation detail record', async () => {
    const { GET } = await import('./route');
    findGenerationMock.mockReturnValue({
      id: 'generation-1',
      kind: 'music',
      source: 'cover-preprocess',
      metadata: { coverFeatureId: 'cover-feature-1' },
      assets: [],
    });

    const response = await GET(new Request('http://localhost/api/library/generations/generation-1', {
      headers: { Authorization: 'Bearer test-key' },
    }), {
      params: Promise.resolve({ generationId: 'generation-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      generation: {
        id: 'generation-1',
        kind: 'music',
        source: 'cover-preprocess',
        metadata: { coverFeatureId: 'cover-feature-1' },
        assets: [],
      },
    });
    expect(findGenerationMock).toHaveBeenCalledWith('generation-1');
  });

  it('returns 404 when a generation detail record is missing', async () => {
    const { GET } = await import('./route');
    findGenerationMock.mockReturnValue(null);

    const response = await GET(new Request('http://localhost/api/library/generations/missing-generation', {
      headers: { Authorization: 'Bearer test-key' },
    }), {
      params: Promise.resolve({ generationId: 'missing-generation' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Generation not found' });
    expect(findGenerationMock).toHaveBeenCalledWith('missing-generation');
  });

  it('deletes metadata and attached local files', async () => {
    const { DELETE } = await import('./route');
    findGenerationMock.mockReturnValue({
      assets: [
        { storageType: 'local_file', storageRef: 'audio/generation-1.mp3' },
        { storageType: 'provider_url', storageRef: 'https://example.com/image.png' },
      ],
    });
    deleteGenerationMock.mockReturnValue(true);
    deleteLocalAssetMock.mockResolvedValue(undefined);

    const response = await DELETE(new Request('http://localhost/api/library/generations/generation-1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer test-key' },
    }), {
      params: Promise.resolve({ generationId: 'generation-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deleted: true });
    expect(deleteGenerationMock).toHaveBeenCalledWith('generation-1');
    expect(deleteLocalAssetMock).toHaveBeenCalledWith('audio/generation-1.mp3');
    expect(deleteLocalAssetMock).toHaveBeenCalledTimes(1);
  });
});
