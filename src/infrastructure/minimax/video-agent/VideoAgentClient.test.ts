/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VideoAgentClient } from './VideoAgentClient';

vi.mock('server-only', () => ({}));

describe('VideoAgentClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.MINIMAX_API_KEY = 'test-minimax-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('creates a template task with the documented body', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      task_id: '401047179385389059',
      base_resp: { status_code: 0, status_msg: 'success' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;

    const result = await new VideoAgentClient().createTemplateTask({
      templateId: '392747428568649728',
      textInputs: [],
      mediaInputs: [{ value: 'https://example.com/a.jpg' }],
    });

    expect(result).toEqual({ taskId: '401047179385389059' });

    const [url, init] = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.minimax.io/v1/video_template_generation');
    expect(JSON.parse(init.body)).toEqual({
      template_id: '392747428568649728',
      media_inputs: [{ value: 'https://example.com/a.jpg' }],
    });
  });

  it('sends the callback url only when one is given', async () => {
    global.fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify({
      task_id: '401047179385389059',
      base_resp: { status_code: 0 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;

    const client = new VideoAgentClient();
    await client.createTemplateTask({
      templateId: '394514820878671878',
      textInputs: [{ value: 'un bosque' }],
      mediaInputs: [],
      callbackUrl: 'https://example.com/hook',
    });

    const [, init] = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      template_id: '394514820878671878',
      text_inputs: [{ value: 'un bosque' }],
      callback_url: 'https://example.com/hook',
    });
  });

  it('never retries a create: the task is billable', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      type: 'error',
      error: { message: 'internal error', http_code: '500' },
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;

    await expect(new VideoAgentClient().createTemplateTask({
      templateId: '392747428568649728',
      textInputs: [],
      mediaInputs: [{ value: 'https://example.com/a.jpg' }],
    })).rejects.toThrow();

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('queries a task and normalizes its status', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      task_id: '401047179385389059',
      status: 'Success',
      video_url: 'https://cdn.hailuoai.com/prod/video.mp4',
      base_resp: { status_code: 0 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;

    const task = await new VideoAgentClient().queryTemplateTask('401047179385389059');

    expect(task).toEqual({
      taskId: '401047179385389059',
      status: 'succeeded',
      videoUrl: 'https://cdn.hailuoai.com/prod/video.mp4',
    });

    const [url] = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.minimax.io/v1/query/video_template_generation?task_id=401047179385389059');
  });

  it('reports a failed task without a video url', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      task_id: '401047179385389059',
      status: 'Fail',
      base_resp: { status_code: 0 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;

    const task = await new VideoAgentClient().queryTemplateTask('401047179385389059');

    expect(task).toEqual({ taskId: '401047179385389059', status: 'failed' });
  });
});
