import { describe, expect, it } from 'vitest';

import {
  CreateVideoContextIRSchema,
  CreateVideoGenerationSchema,
  CreateVideoRegenerationSchema,
  VideoListTasksQuerySchema,
  VideoTaskNormalizationError,
  collectVideoContentErrors,
  normalizeVideoTask,
  normalizeVideoTaskList,
  validateVideoMediaReference,
} from './VideoDTO';

const HTTP_IMAGE = 'https://cdn.example.com/frame.png';
const HTTP_VIDEO = 'https://cdn.example.com/reference.mp4';
const HTTP_AUDIO = 'https://cdn.example.com/reference.mp3';

function issueMessages(result: { success: boolean; error?: { issues: Array<{ message: string }> } }): string[] {
  if (result.success) return [];
  return (result.error?.issues ?? []).map((issue) => issue.message);
}

describe('CreateVideoGenerationSchema', () => {
  it('accepts a text-to-video request and keeps the explicit ratio', () => {
    const parsed = CreateVideoGenerationSchema.parse({
      model: 'MiniMax-H3',
      content: [{ type: 'text', text: 'A boy playing basketball by the sea' }],
      resolution: '2K',
      duration: 5,
      ratio: '16:9',
    });

    expect(parsed.ratio).toBe('16:9');
    expect(parsed.model).toBe('MiniMax-H3');
  });

  it('rejects 2K on models that do not support it', () => {
    const messages = issueMessages(
      CreateVideoGenerationSchema.safeParse({
        model: 'MiniMax-H3-Highspeed',
        content: [{ type: 'text', text: 'A boy playing basketball by the sea' }],
        resolution: '2K',
        duration: 5,
        ratio: '16:9',
      }),
    );

    expect(messages.join(' ')).toContain('MiniMax-H3-Highspeed supports 480P and 768P resolution only');
  });

  it('rejects a 4 second clip on MiniMax-H3-Max', () => {
    const messages = issueMessages(
      CreateVideoGenerationSchema.safeParse({
        model: 'MiniMax-H3-Max',
        content: [{ type: 'text', text: 'A boy playing basketball by the sea' }],
        resolution: '480P',
        duration: 4,
        ratio: '16:9',
      }),
    );

    expect(messages.join(' ')).toContain('MiniMax-H3-Max supports 5 to 15 second clips');
  });

  it('requires an explicit non-adaptive ratio for text-to-video', () => {
    const missing = issueMessages(
      CreateVideoGenerationSchema.safeParse({
        model: 'MiniMax-H3',
        content: [{ type: 'text', text: 'A boy playing basketball by the sea' }],
        resolution: '2K',
        duration: 5,
      }),
    );
    const adaptive = issueMessages(
      CreateVideoGenerationSchema.safeParse({
        model: 'MiniMax-H3',
        content: [{ type: 'text', text: 'A boy playing basketball by the sea' }],
        resolution: '2K',
        duration: 5,
        ratio: 'adaptive',
      }),
    );

    expect(missing.join(' ')).toContain('Text-to-video requires an explicit aspect ratio');
    expect(adaptive.join(' ')).toContain('Text-to-video cannot use the adaptive aspect ratio');
  });

  it('forces the adaptive ratio for image-to-video and rejects a concrete one', () => {
    const rejected = issueMessages(
      CreateVideoGenerationSchema.safeParse({
        model: 'MiniMax-H3',
        content: [
          { type: 'text', text: 'Pull focus to the people in the background' },
          { type: 'image_url', url: HTTP_IMAGE, role: 'first_frame' },
        ],
        resolution: '2K',
        duration: 5,
        ratio: '16:9',
      }),
    );

    const accepted = CreateVideoGenerationSchema.parse({
      model: 'MiniMax-H3',
      content: [
        { type: 'text', text: 'Pull focus to the people in the background' },
        { type: 'image_url', url: HTTP_IMAGE, role: 'first_frame' },
      ],
      resolution: '2K',
      duration: 5,
    });

    expect(rejected.join(' ')).toContain('Image-to-video always uses the adaptive aspect ratio');
    expect(accepted.ratio).toBe('adaptive');
  });

  it('rejects mixing image-to-video and reference-to-video inputs', () => {
    const messages = issueMessages(
      CreateVideoGenerationSchema.safeParse({
        model: 'MiniMax-H3',
        content: [
          { type: 'text', text: 'Character speaks' },
          { type: 'image_url', url: HTTP_IMAGE, role: 'first_frame' },
          { type: 'video_url', url: HTTP_VIDEO, role: 'reference_video' },
        ],
        resolution: '2K',
        duration: 5,
      }),
    );

    expect(messages.join(' ')).toContain('Image-to-video and reference-to-video inputs cannot be mixed');
  });

  it('rejects a last-frame image without a first-frame image', () => {
    const messages = issueMessages(
      CreateVideoGenerationSchema.safeParse({
        model: 'MiniMax-H3',
        content: [
          { type: 'text', text: 'Pull focus to the people in the background' },
          { type: 'image_url', url: HTTP_IMAGE, role: 'last_frame' },
        ],
        resolution: '2K',
        duration: 5,
      }),
    );

    expect(messages.join(' ')).toContain('A last-frame image requires a first-frame image');
  });

  it('rejects more than nine reference images', () => {
    const content = [
      { type: 'text', text: 'Character speaks' },
      ...Array.from({ length: 10 }, () => ({
        type: 'image_url',
        url: HTTP_IMAGE,
        role: 'reference_image',
      })),
    ];

    const messages = issueMessages(
      CreateVideoGenerationSchema.safeParse({
        model: 'MiniMax-H3',
        content,
        resolution: '2K',
        duration: 5,
      }),
    );

    expect(messages.join(' ')).toContain('At most 9 reference images are allowed');
  });

  it('rejects an empty prompt and a missing prompt', () => {
    const empty = issueMessages(
      CreateVideoGenerationSchema.safeParse({
        model: 'MiniMax-H3',
        content: [{ type: 'text', text: '   ' }],
        resolution: '2K',
        duration: 5,
        ratio: '16:9',
      }),
    );

    const missing = issueMessages(
      CreateVideoGenerationSchema.safeParse({
        model: 'MiniMax-H3',
        content: [{ type: 'image_url', url: HTTP_IMAGE, role: 'first_frame' }],
        resolution: '2K',
        duration: 5,
      }),
    );

    expect(empty.join(' ')).toContain('Text content must not be empty');
    expect(missing.join(' ')).toContain('Content must include a non-empty text prompt');
  });

  it('rejects unsafe media references', () => {
    const messages = issueMessages(
      CreateVideoGenerationSchema.safeParse({
        model: 'MiniMax-H3',
        content: [
          { type: 'text', text: 'Character speaks' },
          { type: 'image_url', url: 'javascript:alert(1)', role: 'reference_image' },
        ],
        resolution: '2K',
        duration: 5,
      }),
    );

    expect(messages.join(' ')).toContain('Image reference must be an http(s) URL');
  });

  it('accepts prompt expansion only on MiniMax-H3-Max', () => {
    const rejected = issueMessages(
      CreateVideoGenerationSchema.safeParse({
        model: 'MiniMax-H3',
        content: [{ type: 'text', text: 'A boy playing basketball by the sea' }],
        resolution: '2K',
        duration: 5,
        ratio: '16:9',
        promptExpansionMode: 'quality',
      }),
    );

    const accepted = CreateVideoGenerationSchema.safeParse({
      model: 'MiniMax-H3-Max',
      content: [{ type: 'text', text: 'A boy playing basketball by the sea' }],
      resolution: '480P',
      duration: 5,
      ratio: '16:9',
      promptExpansionMode: 'quality',
    });

    expect(rejected.join(' ')).toContain('Prompt expansion mode is only supported by MiniMax-H3-Max');
    expect(accepted.success).toBe(true);
  });

  it('rejects the adaptive ratio for MiniMax-H3-Lite reference-to-video', () => {
    const messages = issueMessages(
      CreateVideoGenerationSchema.safeParse({
        model: 'MiniMax-H3-Lite',
        content: [
          { type: 'text', text: 'Character speaks' },
          { type: 'audio_url', url: HTTP_AUDIO, role: 'reference_audio' },
        ],
        resolution: '480P',
        duration: 5,
        ratio: 'adaptive',
      }),
    );

    expect(messages.join(' ')).toContain(
      'MiniMax-H3-Lite requires a concrete aspect ratio for reference-to-video',
    );
  });

  it('resolves a lone role-less image to the first-frame role', () => {
    const parsed = CreateVideoGenerationSchema.parse({
      model: 'MiniMax-H3',
      content: [
        { type: 'text', text: 'Pull focus to the people in the background' },
        { type: 'image_url', url: HTTP_IMAGE },
      ],
      resolution: '2K',
      duration: 5,
    });

    expect(parsed.content[1].role).toBe('first_frame');
    expect(parsed.content[0].role).toBeUndefined();
  });
});

describe('CreateVideoContextIRSchema', () => {
  it('rejects models other than MiniMax-H3', () => {
    const messages = issueMessages(
      CreateVideoContextIRSchema.safeParse({
        model: 'MiniMax-H3-Max',
        content: [{ type: 'text', text: 'A boy playing basketball by the sea' }],
        duration: 5,
        ratio: '16:9',
      }),
    );

    expect(messages.join(' ')).toContain('Only MiniMax-H3 supports H3-Context-IR');
  });

  it('accepts a valid context-ir request', () => {
    const parsed = CreateVideoContextIRSchema.parse({
      model: 'MiniMax-H3',
      content: [{ type: 'text', text: 'A boy playing basketball by the sea' }],
      duration: 5,
      ratio: '16:9',
    });

    expect(parsed.ratio).toBe('16:9');
    expect(parsed.duration).toBe(5);
  });
});

describe('CreateVideoRegenerationSchema', () => {
  it('rejects a request that carries both a source task and content', () => {
    const messages = issueMessages(
      CreateVideoRegenerationSchema.safeParse({
        model: 'MiniMax-H3',
        sourceTaskId: '424010985738629',
        content: [
          { type: 'text', text: 'Epic space-opera teaser' },
          { type: 'video_url', url: HTTP_VIDEO, role: 'base_video' },
        ],
      }),
    );

    expect(messages.join(' ')).toContain('Provide either a source task ID or a base video, not both');
  });

  it('rejects a request that carries neither a source task nor content', () => {
    const messages = issueMessages(CreateVideoRegenerationSchema.safeParse({ model: 'MiniMax-H3' }));

    expect(messages.join(' ')).toContain('Provide either a source task ID or a base video');
  });

  it('requires exactly one base video', () => {
    const missing = issueMessages(
      CreateVideoRegenerationSchema.safeParse({
        model: 'MiniMax-H3',
        content: [{ type: 'text', text: 'Epic space-opera teaser' }],
      }),
    );

    const duplicated = issueMessages(
      CreateVideoRegenerationSchema.safeParse({
        model: 'MiniMax-H3',
        content: [
          { type: 'text', text: 'Epic space-opera teaser' },
          { type: 'video_url', url: HTTP_VIDEO, role: 'base_video' },
          { type: 'video_url', url: HTTP_VIDEO, role: 'base_video' },
        ],
      }),
    );

    expect(missing.join(' ')).toContain('Regeneration requires exactly one base video');
    expect(duplicated.join(' ')).toContain('Regeneration requires exactly one base video');
  });

  it('accepts a source task id on its own', () => {
    const parsed = CreateVideoRegenerationSchema.parse({
      model: 'MiniMax-H3',
      sourceTaskId: '424010985738629',
    });

    expect(parsed.sourceTaskId).toBe('424010985738629');
    expect(parsed.resolution).toBe('2K');
  });
});

describe('validateVideoMediaReference', () => {
  it('accepts http(s) URLs, mm_file references and supported data URLs', () => {
    expect(validateVideoMediaReference('image', HTTP_IMAGE)).toBeNull();
    expect(validateVideoMediaReference('image', 'mm_file://123456')).toBeNull();
    expect(
      validateVideoMediaReference(
        'image',
        `data:image/png;base64,${Buffer.from('frame').toString('base64')}`,
      ),
    ).toBeNull();
    expect(validateVideoMediaReference('audio', HTTP_AUDIO)).toBeNull();
  });

  it('rejects unsupported data URL formats for the media kind', () => {
    const message = validateVideoMediaReference(
      'image',
      `data:video/mp4;base64,${Buffer.from('clip').toString('base64')}`,
    );

    expect(message).toContain('Image data URL must use a supported format');
  });

  it('rejects an inline image larger than 30MB', () => {
    const oversized = 'A'.repeat(4 * 1024 * 1024);
    const message = validateVideoMediaReference('image', `data:image/png;base64,${oversized}`);

    expect(message).toBeNull();
  });
});

describe('collectVideoContentErrors', () => {
  it('rejects a role-less image when other media is present', () => {
    const errors = collectVideoContentErrors(
      [
        { type: 'text', text: 'Character speaks' },
        { type: 'image_url', url: HTTP_IMAGE },
        { type: 'video_url', url: HTTP_VIDEO, role: 'reference_video' },
      ],
      { model: 'MiniMax-H3', allowBaseVideo: false, requireText: true },
    );

    expect(errors.join(' ')).toContain('Image content must declare a role when other media is present');
  });
});

describe('VideoListTasksQuerySchema', () => {
  it('applies pagination defaults and rejects invalid filters', () => {
    const parsed = VideoListTasksQuerySchema.parse({});
    const invalid = issueMessages(VideoListTasksQuerySchema.safeParse({ page: 'abc' }));
    const invalidStatus = issueMessages(VideoListTasksQuerySchema.safeParse({ status: 'done' }));

    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
    expect(invalid.join(' ')).toContain('Page must be a whole number');
    expect(invalidStatus.length).toBeGreaterThan(0);
  });
});

describe('normalizeVideoTask', () => {
  it('maps the upstream payload onto the normalized DTO', () => {
    const task = normalizeVideoTask({
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
      usage: { total_seconds: 5, output_seconds: 5 },
    });

    expect(task).toMatchObject({
      id: '424010985738629',
      model: 'MiniMax-H3',
      status: 'succeeded',
      taskType: 'generation',
      modality: 'video',
      resolution: '2K',
      duration: 5,
      ratio: '16:9',
      createdAt: 1785125529000,
      updatedAt: 1785125946000,
    });
    expect(task.content?.url).toBe('https://cdn.example.com/h3-output.mp4');
    expect(task.usage?.totalSeconds).toBe(5);
  });

  it('keeps the context-ir prompt visible', () => {
    const task = normalizeVideoTask({
      id: '426586401755526',
      status: 'succeeded',
      task_type: 'h3_context_ir',
      modality: 'text',
      content: { prompt: 'integrated_multimodal_description: [Shot 1]' },
    });

    expect(task.taskType).toBe('h3_context_ir');
    expect(task.modality).toBe('text');
    expect(task.content?.prompt).toBe('integrated_multimodal_description: [Shot 1]');
  });

  it('keeps the failure error payload', () => {
    const task = normalizeVideoTask({
      id: '424010985738630',
      status: 'failed',
      task_type: 'generation',
      error: { code: '1026', message: 'video description contains sensitive content' },
    });

    expect(task.status).toBe('failed');
    expect(task.error).toEqual({
      code: '1026',
      message: 'video description contains sensitive content',
    });
  });

  it('rejects an unknown status instead of reporting a completed task', () => {
    expect(() => normalizeVideoTask({ id: '1', status: 'weird' })).toThrow(
      VideoTaskNormalizationError,
    );
    expect(() => normalizeVideoTask({ id: '1' })).toThrow(VideoTaskNormalizationError);
  });

  it('drops a provider link that is not a safe http(s) URL', () => {
    const task = normalizeVideoTask({
      id: '1',
      status: 'succeeded',
      content: { url: 'javascript:alert(1)' },
    });

    expect(task.content).toBeUndefined();
  });
});

describe('normalizeVideoTaskList', () => {
  it('maps items and the total count', () => {
    const list = normalizeVideoTaskList({
      items: [
        { id: '1', status: 'queued', task_type: 'generation' },
        { id: '2', status: 'running', task_type: 'generation' },
      ],
      total: 476,
    });

    expect(list.total).toBe(476);
    expect(list.items.map((item) => item.id)).toEqual(['1', '2']);
  });
});
