/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { executeStreamMock } = vi.hoisted(() => ({
  executeStreamMock: vi.fn(),
}));

vi.mock('@/application/use-cases/minimax/asr/TranscribeAudio', () => ({
  TranscribeAudioUseCase: vi.fn().mockImplementation(() => ({ executeStream: executeStreamMock })),
}));

vi.mock('@/infrastructure/minimax/asr/AsrClient', () => ({
  AsrClient: vi.fn().mockImplementation(() => ({})),
}));

function audioFormData(): FormData {
  const formData = new FormData();
  formData.append('file', new File([new Uint8Array([1, 2, 3])], 'sample.wav', { type: 'audio/wav' }));
  return formData;
}

describe('POST /api/minimax/asr/transcriptions/stream', () => {
  beforeEach(() => {
    process.env.APP_ACCESS_KEY = 'test-key';
    executeStreamMock.mockReset();
    executeStreamMock.mockResolvedValue(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"index":0,"delta":"Hola","finish":false}\n\n'));
        controller.close();
      },
    }));
  });

  it('rejects an unauthenticated request before calling MiniMax', async () => {
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/asr/transcriptions/stream', {
      method: 'POST',
      body: audioFormData(),
    }));

    expect(response.status).toBe(401);
    expect(executeStreamMock).not.toHaveBeenCalled();
  });

  it('requires an audio file', async () => {
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/asr/transcriptions/stream', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-key' },
      body: new FormData(),
    }));

    expect(response.status).toBe(400);
    expect(executeStreamMock).not.toHaveBeenCalled();
  });

  it('forwards the upstream events as an SSE response', async () => {
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/asr/transcriptions/stream', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-key' },
      body: audioFormData(),
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    expect(await response.text()).toContain('"delta":"Hola"');
    expect(executeStreamMock).toHaveBeenCalledWith(expect.objectContaining({
      fileName: 'sample.wav',
      responseFormat: 'json',
    }));
  });

  it('maps a validation error to a 400', async () => {
    executeStreamMock.mockRejectedValue(
      Object.assign(new Error('Unsupported audio format'), { name: 'TranscribeAudioValidationError' }),
    );
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/asr/transcriptions/stream', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-key' },
      body: audioFormData(),
    }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Unsupported audio format');
  });
});
