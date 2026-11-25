/** @vitest-environment node */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { recordVideoTaskBestEffort } from './video-library-recording';

const mocks = vi.hoisted(() => ({ upsert: vi.fn() }));
vi.mock('@/infrastructure/sqlite/SQLiteGenerationRepository', () => ({
  SQLiteGenerationRepository: class { upsertTaskGeneration = mocks.upsert; },
}));

describe('video library recording', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('records a completed video with a temporary URL and no invented expiration', () => {
    recordVideoTaskBestEffort({
      id: 'task-1', model: 'MiniMax-H3', taskType: 'generation', status: 'succeeded',
      content: { url: 'https://example.com/video.mp4' }, updatedAt: 1000,
    }, 'A seaside scene');
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'video', source: 'video-generation', status: 'completed', prompt: 'A seaside scene',
      providerTaskId: 'task-1', metadata: expect.objectContaining({ providerStatus: 'succeeded' }),
      assets: [expect.objectContaining({ kind: 'video', storageType: 'provider_url', storageRef: 'https://example.com/video.mp4' })],
    }));
    expect(mocks.upsert.mock.calls[0][0].assets[0].expiresAt).toBeUndefined();
  });

  it('stores Context-IR text and cancellation as metadata, not a fake video', () => {
    recordVideoTaskBestEffort({ id: 'ir-1', taskType: 'h3_context_ir', status: 'succeeded', content: { prompt: 'Enhanced scene' } });
    expect(mocks.upsert).toHaveBeenLastCalledWith(expect.objectContaining({
      source: 'video-context-ir', metadata: expect.objectContaining({ enhancedPrompt: 'Enhanced scene' }), assets: [],
    }));
    recordVideoTaskBestEffort({ id: 'cancelled-1', taskType: 'generation', status: 'cancelled' });
    expect(mocks.upsert).toHaveBeenLastCalledWith(expect.objectContaining({
      status: 'failed', metadata: expect.objectContaining({ providerStatus: 'cancelled' }), assets: [],
    }));
  });

  it('does not attach unsafe provider output URLs or propagate storage failures', () => {
    recordVideoTaskBestEffort({ id: 'bad-1', taskType: 'generation', status: 'succeeded', content: { url: 'javascript:alert(1)' } });
    expect(mocks.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ assets: [] }));
    mocks.upsert.mockImplementationOnce(() => { throw new Error('Storage unavailable'); });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => recordVideoTaskBestEffort({ id: 'queued-1', taskType: 'generation', status: 'queued' })).not.toThrow();
    log.mockRestore();
  });
});
