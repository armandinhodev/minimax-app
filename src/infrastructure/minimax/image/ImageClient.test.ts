/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ImageClient } from './ImageClient';
import { setTelemetryReporterForTests } from '@/lib/telemetry';

vi.mock('server-only', () => ({}));

const JPEG_DATA_URL = `data:image/jpeg;base64,${Buffer.from('portrait').toString('base64')}`;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

const BASE_REQUEST = {
  model: 'MiniMax-H3-Image',
  prompt: 'A cinematic product photo.',
  n: 1,
  outputFormat: 'jpeg',
  responseFormat: 'url',
  outputCompression: 95,
  disablePromptEnhanced: false,
  stream: false,
} as const;

describe('ImageClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.MINIMAX_API_KEY = 'test-minimax-key';
    vi.useFakeTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    setTelemetryReporterForTests(null);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('posts MiniMax-H3-Image text-to-image requests to /v1/images/generations', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({
      created: 1792308678,
      data: [
        { url: 'https://example.com/out-0.jpg', size: '2720x1536', revised_prompt: 'An enhanced prompt.' },
      ],
      output_format: 'jpeg',
      usage: { generated_images: 1, total_tokens: 7254, input_tokens: 3174, output_tokens: 4080 },
      request_id: 'req-1',
    })) as typeof fetch;

    const result = await new ImageClient().generateImage({
      ...BASE_REQUEST,
      n: 2,
      aspectRatio: '16:9',
      area: '2K',
    });

    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.minimax.io/v1/images/generations');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-minimax-key',
    });
    expect(JSON.parse(String(init.body))).toEqual({
      model: 'MiniMax-H3-Image',
      prompt: 'A cinematic product photo.',
      n: 2,
      size: 'auto',
      aspect_ratio: '16:9',
      area: '2K',
      output_format: 'jpeg',
      response_format: 'url',
      output_compression: 95,
      disable_prompt_enhanced: false,
      stream: false,
    });

    expect(result).toEqual({
      id: 'req-1',
      imageUrls: ['https://example.com/out-0.jpg'],
      images: [{
        index: 0,
        url: 'https://example.com/out-0.jpg',
        size: '2720x1536',
        revisedPrompt: 'An enhanced prompt.',
        error: null,
      }],
      metadata: {
        successCount: 1,
        failedCount: 0,
        totalCount: 1,
        outputFormat: 'jpeg',
        requestId: 'req-1',
        created: 1792308678,
        usage: { generatedImages: 1, totalTokens: 7254, inputTokens: 3174, outputTokens: 4080 },
      },
      expiresAt: null,
    });
  });

  it('posts image edits with reference images to /v1/images/edits', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({
      created: 1792308678,
      data: [{ url: 'https://example.com/edit-0.jpg', size: '5440x3072' }],
      output_format: 'jpeg',
      request_id: 'req-edit',
    })) as typeof fetch;

    await new ImageClient().generateImage({
      ...BASE_REQUEST,
      images: [{ imageUrl: JPEG_DATA_URL }, { imageUrl: 'https://example.com/cat.jpg' }],
    });

    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.minimax.io/v1/images/edits');
    expect(JSON.parse(String(init.body))).toEqual({
      model: 'MiniMax-H3-Image',
      prompt: 'A cinematic product photo.',
      n: 1,
      size: 'auto',
      aspect_ratio: 'auto',
      area: '4K',
      output_format: 'jpeg',
      response_format: 'url',
      output_compression: 95,
      stream: false,
      images: [
        { image_url: JPEG_DATA_URL },
        { image_url: 'https://example.com/cat.jpg' },
      ],
    });
  });

  it('sends an explicit size without aspect ratio or area', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({
      data: [{ url: 'https://example.com/out-0.jpg' }],
      output_format: 'png',
      request_id: 'req-size',
    })) as typeof fetch;

    const result = await new ImageClient().generateImage({
      ...BASE_REQUEST,
      size: '2720x1536',
      outputFormat: 'png',
    });

    const [, init] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      model: 'MiniMax-H3-Image',
      prompt: 'A cinematic product photo.',
      n: 1,
      size: '2720x1536',
      output_format: 'png',
      response_format: 'url',
      output_compression: 95,
      disable_prompt_enhanced: false,
      stream: false,
    });
    expect(result.metadata.outputFormat).toBe('png');
  });

  it('reports per-item failures returned inside a successful response', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({
      created: 1792308678,
      data: [
        { url: 'https://example.com/out-0.jpg', size: '2720x1536' },
        { error: { code: '1027', message: 'output image failed content safety check' } },
      ],
      output_format: 'jpeg',
      usage: { generated_images: 1, total_tokens: 7254, input_tokens: 3174, output_tokens: 4080 },
      request_id: 'req-partial',
    })) as typeof fetch;

    const result = await new ImageClient().generateImage({ ...BASE_REQUEST, n: 2 });

    expect(result.imageUrls).toEqual(['https://example.com/out-0.jpg']);
    expect(result.images[1]).toEqual({
      index: 1,
      url: null,
      size: null,
      revisedPrompt: null,
      error: { code: '1027', message: 'output image failed content safety check' },
    });
    expect(result.metadata.successCount).toBe(1);
    expect(result.metadata.failedCount).toBe(1);
    expect(result.metadata.totalCount).toBe(2);
  });

  it('fails with the upstream message when every image fails', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({
      type: 'error',
      error: {
        type: 'unprocessable_entity_error',
        message: 'no image generated: all 2 images failed content safety check (1027)',
        http_code: '422',
      },
      data: [
        { error: { code: '1027', message: 'output image failed content safety check' } },
        { error: { code: '1027', message: 'output image failed content safety check' } },
      ],
      request_id: 'req-failed',
    }, 422)) as typeof fetch;

    await expect(new ImageClient().generateImage({ ...BASE_REQUEST, n: 2 })).rejects.toMatchObject({
      name: 'MiniMaxImageError',
      status: 422,
      message: 'no image generated: all 2 images failed content safety check (1027)',
    });
  });

  it('parses the MiniMax-H3-Image error envelope', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({
      type: 'error',
      error: {
        type: 'bad_request_error',
        message: 'invalid params, size 4096x1024: aspect ratio must be within 1:3 and 3:1 (2013)',
        http_code: '400',
      },
      request_id: 'req-bad',
    }, 400)) as typeof fetch;

    await expect(new ImageClient().generateImage({ ...BASE_REQUEST, size: '2720x1536' })).rejects.toMatchObject({
      name: 'MiniMaxImageError',
      code: 400,
      status: 400,
      message: 'invalid params, size 4096x1024: aspect ratio must be within 1:3 and 3:1 (2013)',
    });
  });

  it('still understands the legacy base_resp error envelope', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({
      base_resp: { status_code: 429, status_msg: 'Slow down' },
    })) as typeof fetch;

    await expect(new ImageClient().generateImage({ ...BASE_REQUEST })).rejects.toMatchObject({
      status: 429,
      code: 429,
    });
  });

  it('does not retry transient generation failures to avoid duplicate image jobs', async () => {
    const report = vi.fn();
    setTelemetryReporterForTests({ report });
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        type: 'error',
        error: { type: 'rate_limit_error', message: 'rate limit exceeded(IPM) (1002)', http_code: '429' },
      }, 429))
      .mockResolvedValueOnce(jsonResponse({
        data: [{ url: 'https://example.com/image.png' }],
      })) as typeof fetch;

    await expect(new ImageClient().generateImage({ ...BASE_REQUEST })).rejects.toMatchObject({
      status: 429,
      code: 429,
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(report).not.toHaveBeenCalled();
  });

  it('keeps the upstream request open for the documented 600 second window', async () => {
    let aborted = false;
    global.fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => {
        aborted = true;
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      });
    })) as typeof fetch;

    const settled = new ImageClient()
      .generateImage({ ...BASE_REQUEST })
      .then(() => null, (error: unknown) => error);

    await vi.advanceTimersByTimeAsync(599_000);
    expect(aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(2_000);
    const error = await settled;
    expect(aborted).toBe(true);
    expect(error).toMatchObject({ name: 'MiniMaxImageError', status: 408 });
  });

  it('aggregates streamed image events into the regular response shape', async () => {
    global.fetch = vi.fn().mockResolvedValue(sseResponse([
      ': keepalive\n\n',
      'event: image_generation.partial_succeeded\n' +
      'data: {"type":"image_generation.partial_succeeded","created":1792308690,"model":"MiniMax-H3-Image","image_index":0,"url":"https://example.com/out-0.jpg","size":"2720x1536","output_format":"jpeg","revised_prompt":"An enhanced prompt."}\n\n',
      'event: image_generation.partial_failed\n' +
      'data: {"type":"image_generation.partial_failed","created":1792308691,"model":"MiniMax-H3-Image","image_index":1,"code":"1027","message":"output image failed content safety check"}\n\n',
      'event: image_generation.completed\n' +
      'data: {"type":"image_generation.completed","created":1792308695,"model":"MiniMax-H3-Image","usage":{"generated_images":1,"total_tokens":13022,"input_tokens":4862,"output_tokens":8160},"request_id":"req-stream"}\n\n',
    ])) as typeof fetch;

    const result = await new ImageClient().generateImage({ ...BASE_REQUEST, n: 2, stream: true });

    const [, init] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ stream: true });
    expect(result.imageUrls).toEqual(['https://example.com/out-0.jpg']);
    expect(result.images).toEqual([
      {
        index: 0,
        url: 'https://example.com/out-0.jpg',
        size: '2720x1536',
        revisedPrompt: 'An enhanced prompt.',
        error: null,
      },
      {
        index: 1,
        url: null,
        size: null,
        revisedPrompt: null,
        error: { code: '1027', message: 'output image failed content safety check' },
      },
    ]);
    expect(result.metadata.successCount).toBe(1);
    expect(result.metadata.failedCount).toBe(1);
    expect(result.metadata.requestId).toBe('req-stream');
    expect(result.metadata.usage).toEqual({
      generatedImages: 1,
      totalTokens: 13022,
      inputTokens: 4862,
      outputTokens: 8160,
    });
  });

  it('fails a streamed request that ends with an error event', async () => {
    global.fetch = vi.fn().mockResolvedValue(sseResponse([
      'event: error\n' +
      'data: {"type":"error","error":{"type":"server_error","message":"internal error (1000)","http_code":"500"},"usage":{"generated_images":0,"total_tokens":0,"input_tokens":0,"output_tokens":0},"request_id":"req-stream-error"}\n\n',
    ])) as typeof fetch;

    await expect(new ImageClient().generateImage({ ...BASE_REQUEST, stream: true })).rejects.toMatchObject({
      name: 'MiniMaxImageError',
      status: 500,
      message: 'internal error (1000)',
    });
  });

  it('requests prompt enhancement from /v1/h3_image_context_ir', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({
      created: 1794023743,
      revised_prompt: 'A ginger tabby cat lounges lazily on a wooden windowsill.',
      aspect_ratio: '3:2',
      usage: { total_tokens: 3489, input_tokens: 3489 },
      request_id: 'req-ir',
    })) as typeof fetch;

    const result = await new ImageClient().enhanceImagePrompt({
      model: 'MiniMax-H3-Image',
      prompt: 'A ginger cat sunbathing on a windowsill.',
    });

    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.minimax.io/v1/h3_image_context_ir');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      model: 'MiniMax-H3-Image',
      prompt: 'A ginger cat sunbathing on a windowsill.',
    });
    expect(result).toEqual({
      revisedPrompt: 'A ginger tabby cat lounges lazily on a wooden windowsill.',
      aspectRatio: '3:2',
      requestId: 'req-ir',
      created: 1794023743,
      usage: { totalTokens: 3489, inputTokens: 3489 },
    });
  });

  it('sends reference images to the context IR endpoint when enhancing an edit', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({
      revised_prompt: 'An enhanced edit prompt.',
      request_id: 'req-ir-edit',
    })) as typeof fetch;

    await new ImageClient().enhanceImagePrompt({
      model: 'MiniMax-H3-Image',
      prompt: 'Replace the cat.',
      images: [{ imageUrl: JPEG_DATA_URL }],
    });

    const [, init] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      model: 'MiniMax-H3-Image',
      prompt: 'Replace the cat.',
      images: [{ image_url: JPEG_DATA_URL }],
    });
  });
});
