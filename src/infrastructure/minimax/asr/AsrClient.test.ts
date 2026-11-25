/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AsrClient, MiniMaxAsrError, parseAsrStreamEvent } from './AsrClient';

vi.mock('server-only', () => ({}));

const AUDIO = Buffer.from([1, 2, 3, 4]);

const DEFAULT_OPTIONS = {
  model: 'asr-1.0' as const,
  responseFormat: 'json' as const,
  timestampLevel: '' as const,
  language: '',
  stream: false,
};

describe('AsrClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.MINIMAX_API_KEY = 'test-minimax-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('posts multipart form data to the ASR endpoint with the documented fields', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      text: 'hola mundo',
      duration: 12.5,
      trace_id: 'trace-1',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;

    const result = await new AsrClient().transcribe(AUDIO, 'sample.wav', DEFAULT_OPTIONS);

    expect(result).toEqual({ text: 'hola mundo', duration: 12.5, traceId: 'trace-1' });

    const [url, init] = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.minimax.io/v1/speech_to_text');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    const body = init.body as FormData;
    expect(body.get('model')).toBe('asr-1.0');
    expect(body.get('response_format')).toBe('json');
    expect(body.get('timestamp_level')).toBe('');
    expect(body.get('stream')).toBe('false');
    expect(body.get('file')).toBeInstanceOf(File);
  });

  it('sends the language header only when a language is selected', async () => {
    global.fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify({
      text: 'hello',
      duration: 1,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;

    const client = new AsrClient();
    await client.transcribe(AUDIO, 'sample.wav', { ...DEFAULT_OPTIONS, language: 'en' });

    const [, init] = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers.language).toBe('en');

    await client.transcribe(AUDIO, 'sample.wav', DEFAULT_OPTIONS);
    const [, secondInit] = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(secondInit.headers.language).toBeUndefined();
  });

  it('normalizes the verbose_json payload with segments and speakers', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      text: 'Hello everyone',
      duration: 12.744,
      n_speakers: 2,
      trace_id: 'trace-2',
      segments: [
        { id: 0, start: 0.1, end: 1.66, speaker: 'S1', text: 'Hello everyone.' },
        { id: 1, start: 2, end: 6.1, speaker: 'S2', text: 'Let me check the question.' },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;

    const result = await new AsrClient().transcribe(AUDIO, 'sample.wav', {
      ...DEFAULT_OPTIONS,
      responseFormat: 'verbose_json',
    });

    expect(result).toMatchObject({
      nSpeakers: 2,
      segments: [
        { id: 0, start: 0.1, end: 1.66, speaker: 'S1', text: 'Hello everyone.' },
        { id: 1, start: 2, end: 6.1, speaker: 'S2', text: 'Let me check the question.' },
      ],
    });
  });

  it('returns raw subtitles for the srt and vtt formats', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('1\n00:00:00,100 --> 00:00:01,660\nHi\n', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })) as typeof fetch;

    const result = await new AsrClient().transcribe(AUDIO, 'sample.wav', {
      ...DEFAULT_OPTIONS,
      responseFormat: 'srt',
    });

    expect(result).toEqual({ format: 'srt', content: '1\n00:00:00,100 --> 00:00:01,660\nHi\n' });
  });

  it('parses the OpenAI-style error envelope', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      type: 'error',
      error: {
        type: 'invalid_request_error',
        message: 'invalid params, audio duration 623.4s exceeds the limit of 500s (2013)',
        http_code: '400',
      },
      request_id: 'req-1',
    }), { status: 400, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;

    await expect(
      new AsrClient().transcribe(AUDIO, 'sample.wav', DEFAULT_OPTIONS),
    ).rejects.toMatchObject({
      name: 'MiniMaxAsrError',
      code: 400,
      status: 400,
      message: 'invalid params, audio duration 623.4s exceeds the limit of 500s (2013)',
    });
  });

  it('never retries: a transcription is billed by audio duration', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      type: 'error',
      error: { type: 'server_error', message: 'internal error (1000)', http_code: '500' },
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;

    await expect(
      new AsrClient().transcribe(AUDIO, 'sample.wav', DEFAULT_OPTIONS),
    ).rejects.toBeInstanceOf(MiniMaxAsrError);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('streams the upstream bytes without buffering them', async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"index":0,"delta":"Hello","finish":false}\n\n'));
        controller.enqueue(encoder.encode('data: {"index":1,"delta":"","finish":true,"duration":26.3}\n\n'));
        controller.close();
      },
    });
    global.fetch = vi.fn().mockResolvedValue(new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })) as typeof fetch;

    const stream = await new AsrClient().transcribeStream(AUDIO, 'sample.wav', {
      ...DEFAULT_OPTIONS,
      stream: true,
    });

    const reader = stream.getReader();
    const chunks: string[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(new TextDecoder().decode(value));
    }

    expect(chunks.join('')).toContain('"delta":"Hello"');
    expect(chunks.join('')).toContain('"finish":true');
  });
});

describe('parseAsrStreamEvent', () => {
  it('parses a data event', () => {
    expect(parseAsrStreamEvent('data: {"index":0,"delta":"Hello","finish":false}')).toEqual({
      index: 0,
      delta: 'Hello',
      finish: false,
    });
  });

  it('keeps the duration of the terminating event', () => {
    expect(parseAsrStreamEvent('data: {"index":2,"delta":"","finish":true,"duration":26.325}')).toEqual({
      index: 2,
      delta: '',
      finish: true,
      duration: 26.325,
    });
  });

  it('ignores blank lines, comments and malformed payloads', () => {
    expect(parseAsrStreamEvent('')).toBeNull();
    expect(parseAsrStreamEvent(': keep-alive')).toBeNull();
    expect(parseAsrStreamEvent('data: not-json')).toBeNull();
    expect(parseAsrStreamEvent('data: {"delta":"missing index"}')).toBeNull();
  });
});
