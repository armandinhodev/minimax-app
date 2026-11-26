/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { executeStreamMock } = vi.hoisted(() => ({
  executeStreamMock: vi.fn(),
}));

vi.mock('@/application/use-cases/minimax/speech/StreamSpeechWebSocket', () => ({
  StreamSpeechWebSocketUseCase: vi.fn().mockImplementation(() => ({ execute: executeStreamMock })),
}));

vi.mock('@/infrastructure/minimax/speech/SpeechWebSocketClient', () => ({
  SpeechWebSocketClient: vi.fn().mockImplementation(() => ({})),
}));

describe('POST /api/minimax/speech/t2a/websocket', () => {
  beforeEach(() => {
    process.env.APP_ACCESS_KEY = 'test-key';
    executeStreamMock.mockReset();
    executeStreamMock.mockResolvedValue(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"data":{"audio":"deadbeef"}}\n\n'));
        controller.close();
      },
    }));
  });

  it('rejects an unauthenticated request before opening the socket', async () => {
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/speech/t2a/websocket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hola', voiceId: 'voice-1' }),
    }));

    expect(response.status).toBe(401);
    expect(executeStreamMock).not.toHaveBeenCalled();
  });

  it('relays the stream as Server-Sent Events', async () => {
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/speech/t2a/websocket', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-key', 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hola', voiceId: 'voice-1' }),
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    expect(await response.text()).toContain('"audio":"deadbeef"');
    expect(executeStreamMock).toHaveBeenCalledWith(expect.objectContaining({
      text: 'hola',
      voiceId: 'voice-1',
    }));
  });

  it('answers 400 for an invalid request', async () => {
    executeStreamMock.mockRejectedValue(
      Object.assign(new Error('The text is required'), {
        name: 'StreamSpeechWebSocketValidationError',
      }),
    );
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/speech/t2a/websocket', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-key', 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '', voiceId: '' }),
    }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('The text is required');
  });
});
