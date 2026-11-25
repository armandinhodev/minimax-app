/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { executeMock, recordMock } = vi.hoisted(() => ({
  executeMock: vi.fn(),
  recordMock: vi.fn(),
}));

vi.mock('@/application/use-cases/video/CreateVideoContextIR', () => ({
  CreateVideoContextIRUseCase: vi.fn().mockImplementation(() => ({ execute: executeMock })),
}));

vi.mock('@/infrastructure/minimax/MiniMaxVideoClient', () => ({
  MiniMaxVideoClient: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@/app/api/minimax/_shared/video-library-recording', () => ({
  recordVideoTaskBestEffort: recordMock,
}));

const AUTH_HEADERS = {
  Authorization: 'Bearer test-key',
  'Content-Type': 'application/json',
};

describe('POST /api/minimax/video/context-ir', () => {
  beforeEach(() => {
    process.env.APP_ACCESS_KEY = 'test-key';
    executeMock.mockReset();
    recordMock.mockReset();
  });

  it('creates a context-ir task and records it as a text task', async () => {
    const { POST } = await import('./route');
    executeMock.mockResolvedValue({ taskId: '426586401755526' });

    const response = await POST(new Request('http://localhost/api/minimax/video/context-ir', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        model: 'MiniMax-H3',
        content: [{ type: 'text', text: 'A boy playing basketball by the sea' }],
        duration: 5,
        ratio: '16:9',
      }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ taskId: '426586401755526' });
    expect(recordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '426586401755526',
        status: 'queued',
        taskType: 'h3_context_ir',
        modality: 'text',
      }),
      'A boy playing basketball by the sea',
    );
  });

  it('rejects a model that does not support context-ir before calling MiniMax', async () => {
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/video/context-ir', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        model: 'MiniMax-H3-Lite',
        content: [{ type: 'text', text: 'A boy playing basketball by the sea' }],
        duration: 5,
        ratio: '16:9',
      }),
    }));

    expect(response.status).toBe(400);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated request before calling MiniMax', async () => {
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/video/context-ir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: [{ type: 'text', text: 'A boy playing basketball by the sea' }],
        duration: 5,
        ratio: '16:9',
      }),
    }));

    expect(response.status).toBe(401);
    expect(executeMock).not.toHaveBeenCalled();
  });
});
