/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { executeMock, recordMock } = vi.hoisted(() => ({
  executeMock: vi.fn(),
  recordMock: vi.fn(),
}));

vi.mock('@/application/use-cases/minimax/video/CreateVideoGeneration', () => ({
  CreateVideoGenerationUseCase: vi.fn().mockImplementation(() => ({ execute: executeMock })),
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

describe('POST /api/minimax/video/generation', () => {
  beforeEach(() => {
    process.env.APP_ACCESS_KEY = 'test-key';
    executeMock.mockReset();
    recordMock.mockReset();
  });

  it('creates a generation task and records the queued task with its prompt', async () => {
    const { POST } = await import('./route');
    executeMock.mockResolvedValue({ taskId: '424010985738629' });

    const response = await POST(new Request('http://localhost/api/minimax/video/generation', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        model: 'MiniMax-H3',
        content: [{ type: 'text', text: 'A boy playing basketball by the sea' }],
        resolution: '2K',
        duration: 5,
        ratio: '16:9',
      }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ taskId: '424010985738629' });
    expect(recordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '424010985738629',
        status: 'queued',
        taskType: 'generation',
        modality: 'video',
      }),
      'A boy playing basketball by the sea',
    );
  });

  it('rejects an unauthenticated request before calling MiniMax', async () => {
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/video/generation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: [{ type: 'text', text: 'A boy playing basketball by the sea' }],
        resolution: '2K',
        duration: 5,
        ratio: '16:9',
      }),
    }));

    expect(response.status).toBe(401);
    expect(executeMock).not.toHaveBeenCalled();
    expect(recordMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid request before calling MiniMax', async () => {
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/video/generation', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        model: 'MiniMax-H3-Highspeed',
        content: [{ type: 'text', text: 'A boy playing basketball by the sea' }],
        resolution: '2K',
        duration: 5,
        ratio: '16:9',
      }),
    }));

    expect(response.status).toBe(400);
    expect(executeMock).not.toHaveBeenCalled();
    expect(recordMock).not.toHaveBeenCalled();
  });

  it('surfaces the upstream failure without recording a task', async () => {
    const { POST } = await import('./route');
    executeMock.mockRejectedValue(Object.assign(
      new Error('video description contains sensitive content (1026)'),
      { name: 'MiniMaxVideoError', code: 1026, status: 422 },
    ));

    const response = await POST(new Request('http://localhost/api/minimax/video/generation', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        model: 'MiniMax-H3',
        content: [{ type: 'text', text: 'A boy playing basketball by the sea' }],
        resolution: '2K',
        duration: 5,
        ratio: '16:9',
      }),
    }));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: 'video description contains sensitive content (1026)',
      code: 1026,
    });
    expect(recordMock).not.toHaveBeenCalled();
  });
});
