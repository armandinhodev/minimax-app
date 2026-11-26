/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { executeMock } = vi.hoisted(() => ({
  executeMock: vi.fn(),
}));

vi.mock('@/application/use-cases/minimax/text/CompleteChat', () => ({
  CompleteChatUseCase: vi.fn().mockImplementation(() => ({ execute: executeMock })),
}));

vi.mock('@/infrastructure/minimax/text/TextClient', () => ({
  TextClient: vi.fn().mockImplementation(() => ({})),
}));

describe('POST /api/minimax/text/chat/completions', () => {
  beforeEach(() => {
    process.env.APP_ACCESS_KEY = 'test-key';
    executeMock.mockReset();
    executeMock.mockResolvedValue({ id: 'r', model: 'MiniMax-M3.1-Flash', content: 'hola' });
  });

  it('rejects an unauthenticated request before calling MiniMax', async () => {
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/text/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hola' }] }),
    }));

    expect(response.status).toBe(401);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('returns the normalized completion', async () => {
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/text/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-key', 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hola' }] }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 'r', model: 'MiniMax-M3.1-Flash', content: 'hola' });
    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'MiniMax-M3.1-Flash' }),
      'native',
    );
  });

  it('answers 400 for an invalid request', async () => {
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/text/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-key', 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [] }),
    }));

    expect(response.status).toBe(400);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('answers 400 for a malformed JSON body', async () => {
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/text/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-key', 'Content-Type': 'application/json' },
      body: 'not-json',
    }));

    expect(response.status).toBe(400);
    expect(executeMock).not.toHaveBeenCalled();
  });
});
