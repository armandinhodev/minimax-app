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

describe('DELETE /api/library/generations/[generationId]', () => {
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
