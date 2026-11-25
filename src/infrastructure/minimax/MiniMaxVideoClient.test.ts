/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MiniMaxVideoClient, MiniMaxVideoError } from './MiniMaxVideoClient';
import { setTelemetryReporterForTests } from '@/lib/telemetry';

vi.mock('server-only', () => ({}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function requestBody(callIndex = 0): Record<string, unknown> {
  const [, init] = vi.mocked(global.fetch).mock.calls[callIndex] as [string, RequestInit];
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

describe('MiniMaxVideoClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.MINIMAX_API_KEY = 'test-minimax-key';
    global.fetch = vi.fn() as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    setTelemetryReporterForTests(null);
    vi.restoreAllMocks();
  });

  it('creates a generation task with the documented multimodal body', async () => {
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse({ task_id: '424010985738629' }));

    const result = await new MiniMaxVideoClient().createGenerationTask({
      model: 'MiniMax-H3',
      content: [
        { type: 'text', text: 'Epic space-opera theatrical teaser' },
        { type: 'image_url', url: 'https://cdn.example.com/frame.png', role: 'first_frame' },
        { type: 'video_url', url: 'https://cdn.example.com/reference.mp4', role: 'reference_video' },
        { type: 'audio_url', url: 'https://cdn.example.com/reference.mp3', role: 'reference_audio' },
      ],
      resolution: '2K',
      duration: 5,
      ratio: 'adaptive',
    });

    expect(result).toEqual({ taskId: '424010985738629' });

    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.minimax.io/v2/video_generation');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-minimax-key',
    });
    expect(requestBody()).toEqual({
      model: 'MiniMax-H3',
      content: [
        { type: 'text', text: 'Epic space-opera theatrical teaser' },
        { type: 'image_url', image_url: { url: 'https://cdn.example.com/frame.png' }, role: 'first_frame' },
        { type: 'video_url', video_url: { url: 'https://cdn.example.com/reference.mp4' }, role: 'reference_video' },
        { type: 'audio_url', audio_url: { url: 'https://cdn.example.com/reference.mp3' }, role: 'reference_audio' },
      ],
      resolution: '2K',
      duration: 5,
      ratio: 'adaptive',
    });
  });

  it('omits the extra block unless the model supports prompt expansion', async () => {
    vi.mocked(global.fetch).mockImplementation(async () => jsonResponse({ task_id: '1' }));

    await new MiniMaxVideoClient().createGenerationTask({
      model: 'MiniMax-H3',
      content: [{ type: 'text', text: 'A boy playing basketball by the sea' }],
      resolution: '2K',
      duration: 5,
      ratio: '16:9',
    });
    await new MiniMaxVideoClient().createGenerationTask({
      model: 'MiniMax-H3-Max',
      content: [{ type: 'text', text: 'A boy playing basketball by the sea' }],
      resolution: '480P',
      duration: 5,
      ratio: '16:9',
      promptExpansionMode: 'quality',
    });

    expect(requestBody(0).extra).toBeUndefined();
    expect(requestBody(1).extra).toEqual({ prompt_expansion_mode: 'quality' });
  });

  it('never retries a create call because the operation is not idempotent', async () => {
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse({
      type: 'error',
      error: { type: 'server_error', message: 'internal error (1000)', http_code: '500' },
    }, 500));

    await expect(new MiniMaxVideoClient().createGenerationTask({
      model: 'MiniMax-H3',
      content: [{ type: 'text', text: 'A boy playing basketball by the sea' }],
      resolution: '2K',
      duration: 5,
      ratio: '16:9',
    })).rejects.toBeInstanceOf(MiniMaxVideoError);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('creates a context-ir task without a resolution field', async () => {
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse({ task_id: '426586401755526' }));

    const result = await new MiniMaxVideoClient().createContextIRTask({
      model: 'MiniMax-H3',
      content: [{ type: 'text', text: 'A boy playing basketball by the sea' }],
      duration: 5,
      ratio: '16:9',
    });

    expect(result).toEqual({ taskId: '426586401755526' });

    const [url] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.minimax.io/v2/h3_context_ir');
    expect(requestBody()).toEqual({
      model: 'MiniMax-H3',
      content: [{ type: 'text', text: 'A boy playing basketball by the sea' }],
      duration: 5,
      ratio: '16:9',
    });
  });

  it('creates a regeneration task from a source task id', async () => {
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse({ task_id: '424010985738631' }));

    const result = await new MiniMaxVideoClient().createRegenerationTask({
      model: 'MiniMax-H3',
      sourceTaskId: '424010985738629',
      resolution: '2K',
    });

    expect(result).toEqual({ taskId: '424010985738631' });

    const [url] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.minimax.io/v2/video_regeneration');
    expect(requestBody()).toEqual({
      model: 'MiniMax-H3',
      source_task_id: '424010985738629',
      resolution: '2K',
    });
  });

  it('creates a regeneration task from a base video', async () => {
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse({ task_id: '424010985738632' }));

    await new MiniMaxVideoClient().createRegenerationTask({
      model: 'MiniMax-H3',
      content: [
        { type: 'text', text: 'Epic space-opera theatrical teaser' },
        { type: 'video_url', url: 'https://cdn.example.com/h3-t2va-768p.mp4', role: 'base_video' },
      ],
      resolution: '2K',
      aigcWatermark: true,
    });

    expect(requestBody()).toEqual({
      model: 'MiniMax-H3',
      content: [
        { type: 'text', text: 'Epic space-opera theatrical teaser' },
        { type: 'video_url', video_url: { url: 'https://cdn.example.com/h3-t2va-768p.mp4' }, role: 'base_video' },
      ],
      resolution: '2K',
      aigc_watermark: true,
    });
  });

  it('queries a task and normalizes the upstream payload', async () => {
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse({
      task: {
        id: '424010985738629',
        model: 'MiniMax-H3',
        status: 'succeeded',
        created_at: 1785125529,
        updated_at: 1785125946,
        content: { url: 'https://cdn.example.com/h3-output.mp4' },
        resolution: '2K',
        duration: 5,
        ratio: '16:9',
        task_type: 'generation',
        modality: 'video',
      },
    }));

    const result = await new MiniMaxVideoClient().queryTask('424010985738629');

    expect(result.task).toMatchObject({
      id: '424010985738629',
      status: 'succeeded',
      taskType: 'generation',
      modality: 'video',
      createdAt: 1785125529000,
    });

    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.minimax.io/v2/query/video_generation/424010985738629');
    expect(init.method).toBe('GET');
  });

  it('encodes the task id in the query path', async () => {
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse({
      task: { id: 'a.b', status: 'queued', task_type: 'generation' },
    }));

    await new MiniMaxVideoClient().queryTask('a.b');

    const [url] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.minimax.io/v2/query/video_generation/a.b');
  });

  it('lists tasks with pagination and filters', async () => {
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse({
      items: [{ id: '1', status: 'queued', task_type: 'generation' }],
      total: 476,
    }));

    const result = await new MiniMaxVideoClient().listTasks({
      pageNum: 2,
      pageSize: 10,
      status: 'queued',
      taskType: 'generation',
      model: 'MiniMax-H3',
      taskIds: ['1', '2'],
    });

    expect(result.total).toBe(476);
    expect(result.items).toHaveLength(1);

    const [url] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://api.minimax.io/v2/query/video_generation?page_num=2&page_size=10' +
      '&filter.status=queued&filter.task_type=generation&filter.model=MiniMax-H3' +
      '&filter.task_ids=1&filter.task_ids=2',
    );
  });

  it('cancels or deletes a task', async () => {
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse({
      task_id: '424010985738629',
      action: 'cancelled',
      status: 'cancelled',
    }));

    const result = await new MiniMaxVideoClient().cancelOrDeleteTask('424010985738629');

    expect(result).toEqual({
      taskId: '424010985738629',
      action: 'cancelled',
      status: 'cancelled',
    });

    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.minimax.io/v2/video_generation/424010985738629');
    expect(init.method).toBe('DELETE');
  });

  it('surfaces the upstream error code and message', async () => {
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse({
      type: 'error',
      error: {
        type: 'unprocessable_entity_error',
        message: 'video description contains sensitive content (1026)',
        http_code: '422',
      },
      request_id: 'req-1',
    }, 422));

    const error = await new MiniMaxVideoClient()
      .createGenerationTask({
        model: 'MiniMax-H3',
        content: [{ type: 'text', text: 'A boy playing basketball by the sea' }],
        resolution: '2K',
        duration: 5,
        ratio: '16:9',
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(MiniMaxVideoError);
    expect(error).toMatchObject({
      code: 1026,
      status: 422,
      message: 'video description contains sensitive content (1026)',
    });
  });

  it('rejects a task payload whose status is unknown instead of reporting success', async () => {
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse({
      task: { id: '1', status: 'mystery' },
    }));

    await expect(new MiniMaxVideoClient().queryTask('1')).rejects.toThrow(
      /unsupported task status/i,
    );
  });

  it('retries a read that fails with a transient upstream status', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(jsonResponse({
        type: 'error',
        error: { type: 'server_error', message: 'internal error (1000)', http_code: '500' },
      }, 500))
      .mockResolvedValueOnce(jsonResponse({
        task: { id: '1', status: 'queued', task_type: 'generation' },
      }));

    const result = await new MiniMaxVideoClient().queryTask('1');

    expect(result.task.status).toBe('queued');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('rejects a task id that cannot be safely encoded', async () => {
    await expect(new MiniMaxVideoClient().queryTask('../secrets')).rejects.toThrow(
      'Invalid MiniMax task ID',
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
