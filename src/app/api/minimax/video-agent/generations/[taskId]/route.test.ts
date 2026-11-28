/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { executeMock } = vi.hoisted(() => ({
  executeMock: vi.fn(),
}));

vi.mock('@/application/use-cases/minimax/video-agent/QueryVideoAgentTask', () => ({
  QueryVideoAgentTaskUseCase: vi.fn().mockImplementation(() => ({ execute: executeMock })),
}));

vi.mock('@/infrastructure/minimax/video-agent/VideoAgentClient', () => ({
  VideoAgentClient: vi.fn().mockImplementation(() => ({})),
}));

const { recordMock } = vi.hoisted(() => ({ recordMock: vi.fn() }));
vi.mock('@/app/api/minimax/_shared/video-library-recording', () => ({
  recordVideoAgentTaskBestEffort: recordMock,
}));

describe('GET /api/minimax/video-agent/generations/[taskId]', () => {
  beforeEach(() => {
    process.env.APP_ACCESS_KEY = 'test-key';
    executeMock.mockReset();
    recordMock.mockReset();
    executeMock.mockResolvedValue({ taskId: '401047179385389059', status: 'processing' });
  });

  it('rejects an unauthenticated request before calling MiniMax', async () => {
    const { GET } = await import('./route');

    const response = await GET(
      new Request('http://localhost/api/minimax/video-agent/generations/401047179385389059'),
      { params: Promise.resolve({ taskId: '401047179385389059' }) },
    );

    expect(response.status).toBe(401);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('returns the normalized task', async () => {
    const { GET } = await import('./route');

    const response = await GET(
      new Request('http://localhost/api/minimax/video-agent/generations/401047179385389059', {
        headers: { Authorization: 'Bearer test-key' },
      }),
      { params: Promise.resolve({ taskId: '401047179385389059' }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ taskId: '401047179385389059', status: 'processing' });
    expect(recordMock).toHaveBeenCalledWith({ taskId: '401047179385389059', status: 'processing' });
  });

  it('records the finished clip so Library shows it', async () => {
    executeMock.mockResolvedValue({
      taskId: '401047179385389059',
      status: 'succeeded',
      videoUrl: 'https://cdn.example.com/agent.mp4',
    });
    const { GET } = await import('./route');

    const response = await GET(
      new Request('http://localhost/api/minimax/video-agent/generations/401047179385389059', {
        headers: { Authorization: 'Bearer test-key' },
      }),
      { params: Promise.resolve({ taskId: '401047179385389059' }) },
    );

    expect(response.status).toBe(200);
    expect(recordMock).toHaveBeenCalledWith({
      taskId: '401047179385389059',
      status: 'succeeded',
      videoUrl: 'https://cdn.example.com/agent.mp4',
    });
  });

  it('maps a malformed task id to a 400', async () => {
    executeMock.mockRejectedValue(
      Object.assign(new Error('The task ID is not a valid MiniMax task ID'), {
        name: 'QueryVideoAgentTaskValidationError',
      }),
    );
    const { GET } = await import('./route');

    const response = await GET(
      new Request('http://localhost/api/minimax/video-agent/generations/abc', {
        headers: { Authorization: 'Bearer test-key' },
      }),
      { params: Promise.resolve({ taskId: 'abc' }) },
    );

    expect(response.status).toBe(400);
    expect(recordMock).not.toHaveBeenCalled();
  });
});
