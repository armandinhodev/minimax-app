/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { queryMock, cancelMock, recordMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  cancelMock: vi.fn(),
  recordMock: vi.fn(),
}));

vi.mock('@/application/use-cases/minimax/video/QueryVideoTask', () => ({
  QueryVideoTaskUseCase: vi.fn().mockImplementation(() => ({ execute: queryMock })),
}));

vi.mock('@/application/use-cases/minimax/video/CancelVideoTask', () => ({
  CancelVideoTaskUseCase: vi.fn().mockImplementation(() => ({ execute: cancelMock })),
}));

vi.mock('@/infrastructure/minimax/video/VideoClient', () => ({
  VideoClient: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@/app/api/minimax/_shared/video-library-recording', () => ({
  recordVideoTaskBestEffort: recordMock,
}));

const AUTH_HEADERS = { Authorization: 'Bearer test-key' };

function taskContext(taskId: string) {
  return { params: Promise.resolve({ taskId }) };
}

describe('/api/minimax/video/tasks/[taskId]', () => {
  beforeEach(() => {
    process.env.APP_ACCESS_KEY = 'test-key';
    queryMock.mockReset();
    cancelMock.mockReset();
    recordMock.mockReset();
  });

  it('returns the queried task and records it', async () => {
    const { GET } = await import('./route');
    queryMock.mockResolvedValue({
      task: { id: '424010985738629', status: 'succeeded', taskType: 'generation', modality: 'video' },
    });

    const response = await GET(
      new Request('http://localhost/api/minimax/video/tasks/424010985738629', { headers: AUTH_HEADERS }),
      taskContext('424010985738629'),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      task: { id: '424010985738629', status: 'succeeded' },
    });
    expect(queryMock).toHaveBeenCalledWith('424010985738629');
    expect(recordMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: '424010985738629', status: 'succeeded' }),
    );
  });

  it('rejects an unauthenticated query before calling MiniMax', async () => {
    const { GET } = await import('./route');

    const response = await GET(
      new Request('http://localhost/api/minimax/video/tasks/424010985738629'),
      taskContext('424010985738629'),
    );

    expect(response.status).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('rejects an unsafe task id before calling MiniMax', async () => {
    const { GET } = await import('./route');

    const response = await GET(
      new Request('http://localhost/api/minimax/video/tasks/..%2Fsecrets', { headers: AUTH_HEADERS }),
      taskContext('../secrets'),
    );

    expect(response.status).toBe(400);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('records a cancelled task with the requested task type', async () => {
    const { DELETE } = await import('./route');
    cancelMock.mockResolvedValue({
      taskId: '424010985738629',
      action: 'cancelled',
      status: 'cancelled',
    });

    const response = await DELETE(
      new Request('http://localhost/api/minimax/video/tasks/424010985738629?taskType=regeneration', {
        method: 'DELETE',
        headers: AUTH_HEADERS,
      }),
      taskContext('424010985738629'),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      taskId: '424010985738629',
      action: 'cancelled',
      status: 'cancelled',
    });
    expect(cancelMock).toHaveBeenCalledWith({
      taskId: '424010985738629',
      taskType: 'regeneration',
    });
    expect(recordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '424010985738629',
        status: 'cancelled',
        taskType: 'regeneration',
      }),
    );
  });

  it('keeps the local history when the upstream record is deleted', async () => {
    const { DELETE } = await import('./route');
    cancelMock.mockResolvedValue({
      taskId: '424010985738629',
      action: 'deleted',
      status: 'deleted',
    });

    const response = await DELETE(
      new Request('http://localhost/api/minimax/video/tasks/424010985738629', {
        method: 'DELETE',
        headers: AUTH_HEADERS,
      }),
      taskContext('424010985738629'),
    );

    expect(response.status).toBe(200);
    expect(recordMock).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated delete before calling MiniMax', async () => {
    const { DELETE } = await import('./route');

    const response = await DELETE(
      new Request('http://localhost/api/minimax/video/tasks/424010985738629', { method: 'DELETE' }),
      taskContext('424010985738629'),
    );

    expect(response.status).toBe(401);
    expect(cancelMock).not.toHaveBeenCalled();
  });
});
