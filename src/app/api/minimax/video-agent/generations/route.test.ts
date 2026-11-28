/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { executeMock } = vi.hoisted(() => ({
  executeMock: vi.fn(),
}));

vi.mock('@/application/use-cases/minimax/video-agent/CreateVideoAgentTask', () => ({
  CreateVideoAgentTaskUseCase: vi.fn().mockImplementation(() => ({ execute: executeMock })),
}));

vi.mock('@/infrastructure/minimax/video-agent/VideoAgentClient', () => ({
  VideoAgentClient: vi.fn().mockImplementation(() => ({})),
}));

const { recordMock } = vi.hoisted(() => ({ recordMock: vi.fn() }));
vi.mock('@/app/api/minimax/_shared/video-library-recording', () => ({
  recordVideoAgentTaskBestEffort: recordMock,
}));

describe('POST /api/minimax/video-agent/generations', () => {
  beforeEach(() => {
    process.env.APP_ACCESS_KEY = 'test-key';
    executeMock.mockReset();
    recordMock.mockReset();
    executeMock.mockResolvedValue({ taskId: '401047179385389059' });
  });

  it('rejects an unauthenticated request before calling MiniMax', async () => {
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/video-agent/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: '392747428568649728' }),
    }));

    expect(response.status).toBe(401);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('creates the task and returns its id', async () => {
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/video-agent/generations', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-key', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateId: '392747428568649728',
        mediaInputs: ['https://example.com/a.jpg'],
      }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ taskId: '401047179385389059' });
    expect(executeMock).toHaveBeenCalledWith(expect.objectContaining({
      templateId: '392747428568649728',
      mediaInputs: [{ value: 'https://example.com/a.jpg' }],
    }));
    expect(recordMock).toHaveBeenCalledWith(
      { taskId: '401047179385389059', status: 'preparing' },
      { prompt: undefined, templateId: '392747428568649728' },
    );
  });

  it('maps a validation error to a 400', async () => {
    executeMock.mockRejectedValue(
      Object.assign(new Error('Unknown template ID'), { name: 'CreateVideoAgentTaskValidationError' }),
    );
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/video-agent/generations', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-key', 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: 'nope' }),
    }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Unknown template ID');
    expect(recordMock).not.toHaveBeenCalled();
  });

  it('passes a Base64 data URL through route and use-case validation unchanged', async () => {
    const path = '@/application/use-cases/minimax/video-agent/CreateVideoAgentTask';
    const mocked = await import('@/application/use-cases/minimax/video-agent/CreateVideoAgentTask');
    const actual = await vi.importActual<typeof mocked>(path);
    vi.mocked(mocked.CreateVideoAgentTaskUseCase).mockImplementationOnce(() =>
      new actual.CreateVideoAgentTaskUseCase({ createTemplateTask: executeMock, queryTemplateTask: vi.fn() }),
    );
    const { POST } = await import('./route');
    // Test the app-side JSON body size as well as the data URL contract. The
    // provider is mocked; its CDN or deployment ingress limits are not tested.
    const image = `data:image/png;base64,${Buffer.alloc(20 * 1024 * 1024 - 1).toString('base64')}`;
    const response = await POST(new Request('http://localhost/api/minimax/video-agent/generations', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-key', 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: '392747428568649728', mediaInputs: [{ value: image }] }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ taskId: '401047179385389059' });
    expect(executeMock.mock.calls[0]?.[0]?.mediaInputs?.[0]?.value === image).toBe(true);
  });
});
