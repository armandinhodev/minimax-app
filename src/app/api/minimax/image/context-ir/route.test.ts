/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { executeMock } = vi.hoisted(() => ({
  executeMock: vi.fn(),
}));

vi.mock('@/application/use-cases/image/EnhanceImagePrompt', () => ({
  EnhanceImagePromptUseCase: vi.fn().mockImplementation(() => ({
    execute: executeMock,
  })),
  EnhanceImagePromptValidationError: class EnhanceImagePromptValidationError extends Error {},
}));

function contextIrRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/minimax/image/context-ir', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer test-key',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/minimax/image/context-ir', () => {
  beforeEach(() => {
    process.env.APP_ACCESS_KEY = 'test-key';
    process.env.MINIMAX_API_KEY = 'test-minimax-key';
    executeMock.mockReset();
  });

  it('requires app authentication', async () => {
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/image/context-ir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'A photo.' }),
    }));

    expect(response.status).toBe(401);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('returns the enhanced prompt', async () => {
    const { POST } = await import('./route');
    executeMock.mockResolvedValue({
      revisedPrompt: 'A ginger tabby cat lounges lazily on a wooden windowsill.',
      aspectRatio: '3:2',
      requestId: 'req-ir',
      created: 1794023743,
      usage: { totalTokens: 3489, inputTokens: 3489 },
    });

    const response = await POST(contextIrRequest({ prompt: 'A ginger cat on a windowsill.' }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      revisedPrompt: 'A ginger tabby cat lounges lazily on a wooden windowsill.',
      aspectRatio: '3:2',
      requestId: 'req-ir',
      created: 1794023743,
      usage: { totalTokens: 3489, inputTokens: 3489 },
    });
    expect(executeMock).toHaveBeenCalledWith(expect.objectContaining({
      model: 'MiniMax-H3-Image',
      prompt: 'A ginger cat on a windowsill.',
    }));
  });

  it('rejects the highspeed model, which the context IR endpoint does not support', async () => {
    const { POST } = await import('./route');

    const response = await POST(contextIrRequest({
      model: 'MiniMax-H3-Image-Highspeed',
      prompt: 'A ginger cat on a windowsill.',
    }));

    expect(response.status).toBe(400);
    expect(executeMock).not.toHaveBeenCalled();
  });
});
