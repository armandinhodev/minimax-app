/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { executeMock, recordMock } = vi.hoisted(() => ({
  executeMock: vi.fn(),
  recordMock: vi.fn(),
}));

vi.mock('@/application/use-cases/minimax/video/CreateVideoRegeneration', () => ({
  CreateVideoRegenerationUseCase: vi.fn().mockImplementation(() => ({ execute: executeMock })),
}));

vi.mock('@/infrastructure/minimax/video/VideoClient', () => ({
  VideoClient: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@/app/api/minimax/_shared/video-library-recording', () => ({
  recordVideoTaskBestEffort: recordMock,
}));

const AUTH_HEADERS = {
  Authorization: 'Bearer test-key',
  'Content-Type': 'application/json',
};

describe('POST /api/minimax/video/regeneration', () => {
  beforeEach(() => {
    process.env.APP_ACCESS_KEY = 'test-key';
    executeMock.mockReset();
    recordMock.mockReset();
  });

  it('creates a regeneration task from a base video and records it', async () => {
    const { POST } = await import('./route');
    executeMock.mockResolvedValue({ taskId: '424010985738631' });

    const response = await POST(new Request('http://localhost/api/minimax/video/regeneration', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        model: 'MiniMax-H3',
        content: [
          { type: 'text', text: 'Epic space-opera theatrical teaser' },
          { type: 'video_url', url: 'https://cdn.example.com/h3-t2va-768p.mp4', role: 'base_video' },
        ],
        resolution: '2K',
      }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ taskId: '424010985738631' });
    expect(recordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '424010985738631',
        status: 'queued',
        taskType: 'regeneration',
        modality: 'video',
      }),
      'Epic space-opera theatrical teaser',
    );
  });

  it('rejects a request that mixes a source task with a base video', async () => {
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/video/regeneration', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        model: 'MiniMax-H3',
        sourceTaskId: '424010985738629',
        content: [
          { type: 'video_url', url: 'https://cdn.example.com/h3-t2va-768p.mp4', role: 'base_video' },
        ],
        resolution: '2K',
      }),
    }));

    expect(response.status).toBe(400);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('rejects a regeneration without any source', async () => {
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/video/regeneration', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ model: 'MiniMax-H3', resolution: '2K' }),
    }));

    expect(response.status).toBe(400);
    expect(executeMock).not.toHaveBeenCalled();
  });
});
