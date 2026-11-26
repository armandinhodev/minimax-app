/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MiniMaxTextError, TextClient } from './TextClient';

vi.mock('server-only', () => ({}));

const REQUEST: Parameters<TextClient['complete']>[0] = {
  model: 'MiniMax-M3.1-Flash',
  messages: [{ role: 'user', content: 'hola' }],
};

describe('TextClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.MINIMAX_API_KEY = 'test-minimax-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('posts to the native path and normalizes the answer', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'resp-1',
      model: 'MiniMax-M3.1-Flash',
      choices: [{ finish_reason: 'stop', message: { content: 'hola!' } }],
      usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;

    const result = await new TextClient().complete(REQUEST, 'native');

    expect(result.content).toBe('hola!');
    expect(result.usage).toEqual({ inputTokens: 3, outputTokens: 4, totalTokens: 7 });

    const [url, init] = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.minimax.io/v1/text/chatcompletion_v2');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer test-minimax-key');
  });

  it('posts to the Anthropic path with the Anthropic body', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'msg-1',
      type: 'message',
      role: 'assistant',
      model: 'MiniMax-M3.1-Flash',
      content: [{ type: 'text', text: 'hola!' }],
      usage: { input_tokens: 3, output_tokens: 4 },
      stop_reason: 'end_turn',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;

    const result = await new TextClient().complete({
      ...REQUEST,
      system: 'sos conciso',
    }, 'anthropic');

    expect(result.content).toBe('hola!');
    expect(result.finishReason).toBe('end_turn');

    const [url, init] = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.minimax.io/anthropic/v1/messages');

    const body = JSON.parse(init.body);
    expect(body.system).toBe('sos conciso');
    expect(body.max_tokens).toBe(4096);
    expect(body.messages).toEqual([{ role: 'user', content: 'hola' }]);
  });

  it('posts to the Responses path with the Responses body', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'resp-2',
      object: 'response',
      model: 'MiniMax-M3.1-Flash',
      status: 'completed',
      output: [{
        type: 'message',
        id: 'resp-2_msg',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'hola!' }],
      }],
      usage: { input_tokens: 3, output_tokens: 4, total_tokens: 7 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;

    const result = await new TextClient().complete(REQUEST, 'responses');

    expect(result.content).toBe('hola!');
    expect(result.finishReason).toBe('stop');

    const [url, init] = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.minimax.io/v1/responses');
    expect(JSON.parse(init.body).input).toEqual([
      { type: 'message', role: 'user', content: 'hola' },
    ]);
  });

  it('parses the OpenAI-style error envelope', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      type: 'error',
      request_id: 'req-1',
      error: { type: 'rate_limit_error', message: 'RPM limit reached' },
    }), { status: 429, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;

    await expect(new TextClient().complete(REQUEST, 'anthropic')).rejects.toMatchObject({
      name: 'MiniMaxTextError',
      status: 429,
      message: 'RPM limit reached',
    });
  });

  it('detects an application error reported inside a 200 response', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'resp-1',
      choices: [],
      base_resp: { status_code: 2013, status_msg: 'invalid params' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;

    await expect(new TextClient().complete(REQUEST, 'native')).rejects.toMatchObject({
      name: 'MiniMaxTextError',
      code: 2013,
      message: 'invalid params',
    });
  });

  it('lists the models', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      object: 'list',
      data: [
        { id: 'MiniMax-M3.1-Flash', object: 'model', created: 1789556118, owned_by: 'minimax' },
        { id: 'MiniMax-M3', object: 'model', created: 1780272000, owned_by: 'minimax' },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;

    const models = await new TextClient().listModels();

    expect(models).toEqual([
      { id: 'MiniMax-M3.1-Flash', created: 1789556118, ownedBy: 'minimax' },
      { id: 'MiniMax-M3', created: 1780272000, ownedBy: 'minimax' },
    ]);

    const [url] = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.minimax.io/v1/models');
  });

  it('retrieves one model', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'MiniMax-M3',
      object: 'model',
      created: 1780272000,
      owned_by: 'minimax',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;

    const model = await new TextClient().getModel('MiniMax-M3');

    expect(model).toEqual({ id: 'MiniMax-M3', created: 1780272000, ownedBy: 'minimax' });

    const [url] = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.minimax.io/v1/models/MiniMax-M3');
  });

  it('estimates the input tokens without invoking the model', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      object: 'response.input_tokens',
      input_tokens: 42,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;

    const estimate = await new TextClient().estimateInputTokens(REQUEST);

    expect(estimate).toEqual({ inputTokens: 42 });

    const [url, init] = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.minimax.io/v1/responses/input_tokens');
    expect(init.method).toBe('POST');
  });

  it('streams the upstream events verbatim', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"ho"}}]}\n\n'));
        controller.close();
      },
    });
    global.fetch = vi.fn().mockResolvedValue(new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })) as typeof fetch;

    const stream = await new TextClient().completeStream(REQUEST, 'native');

    const reader = stream.getReader();
    const chunks: string[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(new TextDecoder().decode(value));
    }

    expect(chunks.join('')).toContain('"content":"ho"');

    const [, init] = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body).stream).toBe(true);
  });

  it('surfaces a transport failure as a MiniMaxTextError', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('socket hang up')) as typeof fetch;

    await expect(new TextClient().complete(REQUEST, 'native')).rejects.toBeInstanceOf(MiniMaxTextError);
  });
});
