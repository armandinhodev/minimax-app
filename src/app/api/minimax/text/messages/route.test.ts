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

describe('POST /api/minimax/text/messages', () => {
  beforeEach(() => {
    process.env.APP_ACCESS_KEY = 'test-key';
    executeMock.mockReset();
    executeMock.mockResolvedValue({
      id: 'msg-1',
      model: 'MiniMax-M3.1-Flash',
      content: 'hola',
      finishReason: 'end_turn',
    });
  });

  it('runs the completion against the Anthropic surface', async () => {
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/text/messages', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-key', 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: 'sos conciso', messages: [{ role: 'user', content: 'hola' }] }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ content: 'hola', finishReason: 'end_turn' });
    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({ system: 'sos conciso' }),
      'anthropic',
    );
  });

  it('rejects an unauthenticated request', async () => {
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/text/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hola' }] }),
    }));

    expect(response.status).toBe(401);
    expect(executeMock).not.toHaveBeenCalled();
  });
});
