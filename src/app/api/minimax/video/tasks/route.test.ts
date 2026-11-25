/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { executeMock, recordMock } = vi.hoisted(() => ({
  executeMock: vi.fn(),
  recordMock: vi.fn(),
}));

vi.mock('@/application/use-cases/minimax/video/ListVideoTasks', () => ({
  ListVideoTasksUseCase: vi.fn().mockImplementation(() => ({ execute: executeMock })),
}));

vi.mock('@/infrastructure/minimax/video/VideoClient', () => ({
  VideoClient: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@/app/api/minimax/_shared/video-library-recording', () => ({
  recordVideoTaskBestEffort: recordMock,
}));

describe('GET /api/minimax/video/tasks', () => {
  beforeEach(() => {
    process.env.APP_ACCESS_KEY = 'test-key';
    executeMock.mockReset();
    recordMock.mockReset();
  });

  it('lists tasks and records every returned task', async () => {
    const { GET } = await import('./route');
    executeMock.mockResolvedValue({
      items: [
        { id: '1', status: 'succeeded', taskType: 'generation' },
        { id: '2', status: 'running', taskType: 'generation' },
      ],
      total: 476,
    });

    const response = await GET(new Request(
      'http://localhost/api/minimax/video/tasks?page=2&pageSize=10&status=queued&taskIds=1,2',
      { headers: { Authorization: 'Bearer test-key' } },
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ total: 476 });
    expect(executeMock).toHaveBeenCalledWith(expect.objectContaining({
      page: 2,
      pageSize: 10,
      status: 'queued',
      taskIds: ['1', '2'],
    }));
    expect(recordMock).toHaveBeenCalledTimes(2);
  });

  it('rejects an unauthenticated request before calling MiniMax', async () => {
    const { GET } = await import('./route');

    const response = await GET(new Request('http://localhost/api/minimax/video/tasks'));

    expect(response.status).toBe(401);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('rejects an unknown status filter before calling MiniMax', async () => {
    const { GET } = await import('./route');

    const response = await GET(new Request(
      'http://localhost/api/minimax/video/tasks?status=done',
      { headers: { Authorization: 'Bearer test-key' } },
    ));

    expect(response.status).toBe(400);
    expect(executeMock).not.toHaveBeenCalled();
  });
});
