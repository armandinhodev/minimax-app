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

describe('POST /api/minimax/video-agent/generations', () => {
  beforeEach(() => {
    process.env.APP_ACCESS_KEY = 'test-key';
    executeMock.mockReset();
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
  });
});
