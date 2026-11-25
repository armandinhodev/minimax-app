/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { executeMock } = vi.hoisted(() => ({
  executeMock: vi.fn(),
}));

vi.mock('@/application/use-cases/minimax/asr/TranscribeAudio', () => ({
  TranscribeAudioUseCase: vi.fn().mockImplementation(() => ({ execute: executeMock })),
}));

vi.mock('@/infrastructure/minimax/asr/AsrClient', () => ({
  AsrClient: vi.fn().mockImplementation(() => ({})),
}));

function audioFormData(extra: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.append('file', new File([new Uint8Array([1, 2, 3])], 'sample.wav', { type: 'audio/wav' }));
  for (const [key, value] of Object.entries(extra)) {
    formData.append(key, value);
  }
  return formData;
}

describe('POST /api/minimax/asr/transcriptions', () => {
  beforeEach(() => {
    process.env.APP_ACCESS_KEY = 'test-key';
    executeMock.mockReset();
    executeMock.mockResolvedValue({ text: 'hola mundo', duration: 12.5 });
  });

  it('rejects an unauthenticated request before calling MiniMax', async () => {
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/asr/transcriptions', {
      method: 'POST',
      body: audioFormData(),
    }));

    expect(response.status).toBe(401);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('requires an audio file', async () => {
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/asr/transcriptions', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-key' },
      body: new FormData(),
    }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('file (File) is required');
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('returns the JSON transcript', async () => {
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/asr/transcriptions', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-key' },
      body: audioFormData({ response_format: 'json', language: 'en' }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ text: 'hola mundo', duration: 12.5 });
    expect(executeMock).toHaveBeenCalledWith(expect.objectContaining({
      fileName: 'sample.wav',
      responseFormat: 'json',
      language: 'en',
    }));
  });

  it('returns raw subtitles with the matching content type', async () => {
    executeMock.mockResolvedValue({ format: 'srt', content: '1\n00:00:00,100 --> 00:00:01,660\nHi\n' });
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/asr/transcriptions', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-key' },
      body: audioFormData({ response_format: 'srt' }),
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/plain');
    expect(await response.text()).toContain('00:00:00,100');
  });

  it('maps a validation error to a 400', async () => {
    executeMock.mockRejectedValue(
      Object.assign(new Error('Audio must be 50MB or smaller'), { name: 'TranscribeAudioValidationError' }),
    );
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/asr/transcriptions', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-key' },
      body: audioFormData(),
    }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Audio must be 50MB or smaller');
  });

  it('maps an upstream failure to a 500 with a safe message', async () => {
    executeMock.mockRejectedValue(new Error('upstream exploded'));
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/asr/transcriptions', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-key' },
      body: audioFormData(),
    }));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('An unexpected error occurred. Please try again.');
  });
});
