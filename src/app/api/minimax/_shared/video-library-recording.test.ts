/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { recordVideoAgentTaskBestEffort, recordVideoTaskBestEffort } from './video-library-recording';

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

  it('records a Video Agent task while it is pending, so Library lists it immediately', () => {
    recordVideoAgentTaskBestEffort(
      { taskId: '583074281249136648', status: 'preparing' },
      { prompt: 'A product film', templateId: '394176968202485769' },
    );

    expect(mocks.upsert).toHaveBeenLastCalledWith(expect.objectContaining({
      kind: 'video',
      source: 'video-agent',
      status: 'processing',
      providerTaskId: '583074281249136648',
      prompt: 'A product film',
      assets: [],
      metadata: expect.objectContaining({
        providerStatus: 'preparing',
        templateId: '394176968202485769',
      }),
    }));
  });

  it('attaches the finished Video Agent clip as a temporary provider URL', () => {
    recordVideoAgentTaskBestEffort({
      taskId: '583074281249136648',
      status: 'succeeded',
      videoUrl: 'https://cdn.example.com/agent.mp4',
    });

    expect(mocks.upsert).toHaveBeenLastCalledWith(expect.objectContaining({
      source: 'video-agent',
      status: 'completed',
      metadata: expect.objectContaining({ providerStatus: 'succeeded' }),
      assets: [expect.objectContaining({
        kind: 'video',
        storageType: 'provider_url',
        storageRef: 'https://cdn.example.com/agent.mp4',
        format: 'mp4',
        mimeType: 'video/mp4',
        metadata: expect.objectContaining({ temporaryUrl: true, expirationUnknown: true }),
      })],
    }));
  });

  it('marks a failed Video Agent task and never attaches an unsafe URL', () => {
    recordVideoAgentTaskBestEffort({
      taskId: 'failed-agent',
      status: 'failed',
      videoUrl: 'javascript:alert(1)',
      error: { message: 'The clip was rejected' },
    });

    expect(mocks.upsert).toHaveBeenLastCalledWith(expect.objectContaining({
      source: 'video-agent',
      status: 'failed',
      assets: [],
      metadata: expect.objectContaining({
        providerStatus: 'failed',
        providerError: 'The clip was rejected',
      }),
    }));
  });

  it('does not turn a recorded Video Agent task into a route failure', () => {
    mocks.upsert.mockImplementationOnce(() => { throw new Error('Storage unavailable'); });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => recordVideoAgentTaskBestEffort({ taskId: 'agent-1', status: 'processing' })).not.toThrow();
    expect(log).toHaveBeenCalledWith('Failed to persist Video Agent task metadata.');

    log.mockRestore();
  });

  it('records a failure without provider details and without inventing an asset', () => {
    recordVideoAgentTaskBestEffort({ taskId: 'failed-no-error', status: 'failed' });

    expect(mocks.upsert).toHaveBeenLastCalledWith(expect.objectContaining({
      source: 'video-agent',
      status: 'failed',
      assets: [],
      metadata: expect.not.objectContaining({ providerError: expect.anything() }),
    }));
  });

  it('does not attach an asset when a succeeded task has no usable URL', () => {
    recordVideoAgentTaskBestEffort({ taskId: 'no-url', status: 'succeeded' });
    recordVideoAgentTaskBestEffort({ taskId: 'bad-url', status: 'succeeded', videoUrl: 'not a url' });

    expect(mocks.upsert).toHaveBeenNthCalledWith(1, expect.objectContaining({ status: 'completed', assets: [] }));
    expect(mocks.upsert).toHaveBeenNthCalledWith(2, expect.objectContaining({ status: 'completed', assets: [] }));
  });
});
