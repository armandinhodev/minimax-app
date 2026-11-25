/**
 * Video DTOs — public contracts for the MiniMax H3 video suite.
 *
 * Authoritative sources (official MiniMax documentation, read 2026-11-11):
 * - /api-reference/video-generation-v2-create
 * - /api-reference/video-generation-v2-h3-context-ir
 * - /api-reference/video-generation-v2-regeneration
 * - /api-reference/video-generation-v2-query
 * - /api-reference/video-generation-v2-list
 * - /api-reference/video-generation-v2-delete
 *
 * This module owns the vocabulary shared by the browser, the API routes, the
 * use cases and the MiniMax HTTP client. It never performs network calls:
 * media references are validated syntactically only, because the server must
 * never fetch a user supplied URL.
 */

import { z } from 'zod';

/* -------------------------------------------------------------------------- *
 * Primitive vocabularies
 * -------------------------------------------------------------------------- */

export const VIDEO_MODELS = [
  'MiniMax-H3',
  'MiniMax-H3-Highspeed',
  'MiniMax-H3-Lite',
  'MiniMax-H3-Max',
  'MiniMax-H3-Max-Turbo',
  'MiniMax-H3-MG',
  'MiniMax-H3-NC',
] as const;

export type VideoModel = (typeof VIDEO_MODELS)[number];
export const VideoModelSchema = z.enum(VIDEO_MODELS);

export const VIDEO_RESOLUTIONS = ['480P', '768P', '2K'] as const;
export type VideoResolution = (typeof VIDEO_RESOLUTIONS)[number];
export const VideoResolutionSchema = z.enum(VIDEO_RESOLUTIONS);

export const VIDEO_RATIOS = ['adaptive', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'] as const;
export type VideoRatio = (typeof VIDEO_RATIOS)[number];
export const VideoRatioSchema = z.enum(VIDEO_RATIOS);

export const VIDEO_TASK_STATUSES = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
] as const;
export type VideoTaskStatus = (typeof VIDEO_TASK_STATUSES)[number];
export const VideoTaskStatusSchema = z.enum(VIDEO_TASK_STATUSES);

export const VIDEO_TASK_TYPES = ['generation', 'h3_context_ir', 'regeneration'] as const;
export type VideoTaskType = (typeof VIDEO_TASK_TYPES)[number];
export const VideoTaskTypeSchema = z.enum(VIDEO_TASK_TYPES);

export const VIDEO_MODALITIES = ['video', 'text'] as const;
export type VideoModality = (typeof VIDEO_MODALITIES)[number];
export const VideoModalitySchema = z.enum(VIDEO_MODALITIES);

export const VIDEO_CONTENT_TYPES = ['text', 'image_url', 'video_url', 'audio_url'] as const;
export type VideoContentType = (typeof VIDEO_CONTENT_TYPES)[number];

export const VIDEO_CONTENT_ROLES = [
  'first_frame',
  'last_frame',
  'reference_image',
  'reference_video',
  'reference_audio',
  'base_video',
] as const;
export type VideoContentRole = (typeof VIDEO_CONTENT_ROLES)[number];
export const VideoContentRoleSchema = z.enum(VIDEO_CONTENT_ROLES);

export const VIDEO_PROMPT_EXPANSION_MODES = ['disabled', 'balanced', 'quality'] as const;
export type VideoPromptExpansionMode = (typeof VIDEO_PROMPT_EXPANSION_MODES)[number];
export const VideoPromptExpansionModeSchema = z.enum(VIDEO_PROMPT_EXPANSION_MODES);

/**
 * MiniMax task identifiers are opaque strings returned by the create
 * endpoints. They are validated before they ever reach an upstream URL.
 */
export const VideoTaskIdSchema = z
  .string()
  .trim()
  .min(1, 'Task ID is required')
  .max(64, 'Task ID is too long')
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/, 'Task ID contains unsupported characters');

/* -------------------------------------------------------------------------- *
 * Per-model capabilities
 * -------------------------------------------------------------------------- */

export interface VideoModelCapabilities {
  /** Resolutions the model accepts. */
  readonly resolutions: readonly VideoResolution[];
  /** Minimum accepted duration in seconds. */
  readonly minDuration: number;
  /** Maximum accepted duration in seconds. */
  readonly maxDuration: number;
  /** Whether the model accepts the `adaptive` aspect ratio. */
  readonly supportsAdaptiveRatio: boolean;
}

/**
 * Capability matrix taken verbatim from the create-task documentation.
 *
 * `MiniMax-H3` reaches 2K and also serves 480P; `MiniMax-H3-MG` reaches 2K
 * but no 480P; `MiniMax-H3-Max` and `MiniMax-H3-Max-Turbo` refuse 4 second
 * clips; `MiniMax-H3-Lite` and `MiniMax-H3-NC` refuse the `adaptive` ratio.
 */
export const VIDEO_MODEL_CAPABILITIES: Record<VideoModel, VideoModelCapabilities> = {
  'MiniMax-H3': {
    resolutions: ['480P', '768P', '2K'],
    minDuration: 4,
    maxDuration: 15,
    supportsAdaptiveRatio: true,
  },
  'MiniMax-H3-Highspeed': {
    resolutions: ['480P', '768P'],
    minDuration: 4,
    maxDuration: 15,
    supportsAdaptiveRatio: true,
  },
  'MiniMax-H3-Lite': {
    resolutions: ['480P', '768P'],
    minDuration: 4,
    maxDuration: 15,
    supportsAdaptiveRatio: false,
  },
  'MiniMax-H3-Max': {
    resolutions: ['480P', '768P'],
    minDuration: 5,
    maxDuration: 15,
    supportsAdaptiveRatio: true,
  },
  'MiniMax-H3-Max-Turbo': {
    resolutions: ['480P', '768P'],
    minDuration: 5,
    maxDuration: 15,
    supportsAdaptiveRatio: true,
  },
  'MiniMax-H3-MG': {
    resolutions: ['768P', '2K'],
    minDuration: 4,
    maxDuration: 15,
    supportsAdaptiveRatio: true,
  },
  'MiniMax-H3-NC': {
    resolutions: ['480P', '768P'],
    minDuration: 4,
    maxDuration: 15,
    supportsAdaptiveRatio: false,
  },
};

/**
 * Models that accept `extra.prompt_expansion_mode`.
 */
export const VIDEO_PROMPT_EXPANSION_MODELS: readonly VideoModel[] = [
  'MiniMax-H3-Max',
  'MiniMax-H3-Max-Turbo',
];

export function supportsPromptExpansionMode(model: VideoModel): boolean {
  return VIDEO_PROMPT_EXPANSION_MODELS.includes(model);
}

/** The only model that exposes the H3-Context-IR and regeneration endpoints. */
export const VIDEO_CONTEXT_IR_MODEL: VideoModel = 'MiniMax-H3';

/* -------------------------------------------------------------------------- *
 * Media reference syntax
 * -------------------------------------------------------------------------- */

export type VideoMediaKind = 'image' | 'video' | 'audio';

const MB = 1024 * 1024;

export const VIDEO_MEDIA_BYTE_LIMITS: Record<VideoMediaKind, number> = {
  image: 30 * MB,
  video: 50 * MB,
  audio: 15 * MB,
};

/** The documented ceiling for the whole request body. */
export const VIDEO_REQUEST_BODY_BYTE_LIMIT = 64 * MB;

const MM_FILE_PATTERN = /^mm_file:\/\/(\d+)$/;

const DATA_URL_PATTERNS: Record<VideoMediaKind, RegExp> = {
  image: /^data:image\/(jpeg|jpg|png|webp|heic|heif);base64,([A-Za-z0-9+/]+={0,2})$/i,
  video: /^data:video\/mp4;base64,([A-Za-z0-9+/]+={0,2})$/i,
  audio: /^data:audio\/(wav|mp3);base64,([A-Za-z0-9+/]+={0,2})$/i,
};

const MEDIA_LABELS: Record<VideoMediaKind, string> = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
};

/**
 * Decoded byte length of a Base64 payload, or null when the payload is not
 * valid Base64.
 */
export function getDataUrlByteLength(payload: string): number | null {
  if (payload.length === 0 || payload.length % 4 !== 0) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) return null;

  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return (payload.length / 4) * 3 - padding;
}

/**
 * True when the value is an absolute http(s) URL without embedded
 * credentials. Used both for inbound media references and for provider output
 * links, which must never be embedded unvalidated.
 */
export function isSafeHttpUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (url.hostname.length === 0) return false;
  if (url.username.length > 0 || url.password.length > 0) return false;

  return true;
}

/**
 * Validates the syntax of a media reference without touching the network.
 * Returns an error message, or null when the reference is acceptable.
 */
export function validateVideoMediaReference(kind: VideoMediaKind, value: string): string | null {
  const trimmed = value.trim();
  const label = MEDIA_LABELS[kind];

  if (trimmed.length === 0) {
    return `${label} reference is required`;
  }

  if (MM_FILE_PATTERN.test(trimmed)) {
    return null;
  }

  const dataUrlMatch = DATA_URL_PATTERNS[kind].exec(trimmed);
  if (dataUrlMatch) {
    const byteLength = getDataUrlByteLength(dataUrlMatch[2] ?? '');
    if (byteLength === null) {
      return `${label} data URL payload is not valid Base64`;
    }
    if (byteLength > VIDEO_MEDIA_BYTE_LIMITS[kind]) {
      return `${label} data URL must be smaller than ${VIDEO_MEDIA_BYTE_LIMITS[kind] / MB}MB`;
    }
    return null;
  }

  if (/^data:/i.test(trimmed)) {
    return `${label} data URL must use a supported format and Base64 encoding`;
  }

  if (isSafeHttpUrl(trimmed)) {
    return null;
  }

  return `${label} reference must be an http(s) URL, an mm_file:// reference, or a supported data URL`;
}

/* -------------------------------------------------------------------------- *
 * Content items
 * -------------------------------------------------------------------------- */

export const VIDEO_MAX_PROMPT_LENGTH = 7000;
export const VIDEO_MAX_REGENERATION_PROMPT_LENGTH = 40000;

function createContentInputSchema(maxTextLength: number) {
  return z.object({
    type: z.enum(VIDEO_CONTENT_TYPES),
    text: z
      .string()
      .trim()
      .min(1, 'Text content must not be empty')
      .max(maxTextLength, `Text content must be at most ${maxTextLength} characters`)
      .optional(),
    url: z.string().trim().min(1, 'Media URL is required').optional(),
    role: VideoContentRoleSchema.optional(),
  });
}

export const VideoContentInputSchema = createContentInputSchema(VIDEO_MAX_PROMPT_LENGTH);
export const VideoRegenerationContentInputSchema = createContentInputSchema(
  VIDEO_MAX_REGENERATION_PROMPT_LENGTH,
);

export type VideoContentInput = z.infer<typeof VideoContentInputSchema>;
export type VideoRegenerationContentInput = z.infer<typeof VideoRegenerationContentInputSchema>;

const MEDIA_KIND_BY_TYPE: Record<Exclude<VideoContentType, 'text'>, VideoMediaKind> = {
  image_url: 'image',
  video_url: 'video',
  audio_url: 'audio',
};

const TYPE_LABELS: Record<VideoContentType, string> = {
  text: 'Text',
  image_url: 'Image',
  video_url: 'Video',
  audio_url: 'Audio',
};

const ALLOWED_ROLES_BY_TYPE: Record<VideoContentType, readonly VideoContentRole[]> = {
  text: [],
  image_url: ['first_frame', 'last_frame', 'reference_image'],
  video_url: ['reference_video', 'base_video'],
  audio_url: ['reference_audio'],
};

export type VideoScenario = 'text-to-video' | 'image-to-video' | 'reference-to-video';

/**
 * Resolves the effective role of every content item.
 *
 * The upstream API defaults a single, role-less image to `first_frame`; that
 * default only holds when the image is the sole media item, otherwise the
 * intent is ambiguous and the request is rejected.
 */
export function resolveVideoContentRoles(
  content: readonly VideoContentInput[],
): Array<VideoContentInput & { resolvedRole?: VideoContentRole }> {
  const mediaCount = content.filter((item) => item.type !== 'text').length;

  return content.map((item) => {
    if (item.type !== 'image_url' || item.role) return item;
    if (mediaCount !== 1) return item;
    return { ...item, resolvedRole: 'first_frame' as const };
  });
}

/**
 * Applies the documented "single role-less image defaults to first_frame"
 * rule so the upstream request body is always explicit.
 */
export function resolveVideoContentRolesForRequest(
  content: readonly VideoContentInput[],
): VideoContentInput[] {
  return resolveVideoContentRoles(content).map(({ resolvedRole, ...item }) => (
    resolvedRole ? { ...item, role: resolvedRole } : item
  ));
}

/**
 * Determines the generation scenario implied by the content array.
 */
export function resolveVideoScenario(
  content: readonly VideoContentInput[],
): VideoScenario {
  const resolved = resolveVideoContentRoles(content);
  const hasFrame = resolved.some(
    (item) => item.type === 'image_url' && (item.resolvedRole ?? item.role) === 'first_frame',
  ) || resolved.some(
    (item) => item.type === 'image_url' && (item.resolvedRole ?? item.role) === 'last_frame',
  );
  if (hasFrame) return 'image-to-video';

  const hasReference = resolved.some((item) => {
    const role = item.resolvedRole ?? item.role;
    return role === 'reference_image' || role === 'reference_video' || role === 'reference_audio';
  });
  if (hasReference) return 'reference-to-video';

  return 'text-to-video';
}

export interface VideoContentRuleOptions {
  /** Model that will run the request — drives duration and ratio limits. */
  model: VideoModel;
  /** Whether a `base_video` item is accepted (regeneration only). */
  allowBaseVideo: boolean;
  /** Whether at least one text item is mandatory. */
  requireText: boolean;
  /** Maximum number of reference images. */
  maxReferenceImages?: number;
  /** Maximum number of reference videos. */
  maxReferenceVideos?: number;
  /** Maximum number of reference audio items. */
  maxReferenceAudio?: number;
}

/**
 * Validates a content array against the documented combinations.
 * Returns every problem found so the caller can surface them together.
 */
export function collectVideoContentErrors(
  content: readonly VideoContentInput[],
  options: VideoContentRuleOptions,
): string[] {
  const errors: string[] = [];
  const maxReferenceImages = options.maxReferenceImages ?? 9;
  const maxReferenceVideos = options.maxReferenceVideos ?? 3;
  const maxReferenceAudio = options.maxReferenceAudio ?? 3;

  const mediaCount = content.filter((item) => item.type !== 'text').length;
  const resolved = resolveVideoContentRoles(content);

  let textCount = 0;
  let firstFrameCount = 0;
  let lastFrameCount = 0;
  let referenceImageCount = 0;
  let referenceVideoCount = 0;
  let referenceAudioCount = 0;
  let baseVideoCount = 0;

  for (const item of resolved) {
    if (item.type === 'text') {
      textCount += 1;
      if (!item.text) errors.push('Text content must include a prompt');
      if (item.url) errors.push('Text content must not include a media URL');
      if (item.role) errors.push('Text content must not include a role');
      continue;
    }

    const label = TYPE_LABELS[item.type];

    if (!item.url) {
      errors.push(`${label} content must include a URL`);
      continue;
    }
    if (item.text) {
      errors.push(`${label} content must not include text`);
    }

    const referenceError = validateVideoMediaReference(MEDIA_KIND_BY_TYPE[item.type], item.url);
    if (referenceError) errors.push(referenceError);

    const role = item.resolvedRole ?? item.role;

    if (role) {
      if (!ALLOWED_ROLES_BY_TYPE[item.type].includes(role)) {
        errors.push(`${label} content cannot use the ${role} role`);
        continue;
      }
      if (role === 'base_video' && !options.allowBaseVideo) {
        errors.push('The base_video role is only supported by video regeneration');
        continue;
      }
    } else if (item.type === 'image_url' && mediaCount !== 1) {
      errors.push('Image content must declare a role when other media is present');
    }

    switch (role) {
      case 'first_frame':
        firstFrameCount += 1;
        break;
      case 'last_frame':
        lastFrameCount += 1;
        break;
      case 'reference_image':
        referenceImageCount += 1;
        break;
      case 'reference_video':
        referenceVideoCount += 1;
        break;
      case 'reference_audio':
        referenceAudioCount += 1;
        break;
      case 'base_video':
        baseVideoCount += 1;
        break;
      default:
        break;
    }
  }

  if (options.requireText && textCount === 0) {
    errors.push('Content must include a non-empty text prompt');
  }
  if (textCount > 1) {
    errors.push('Content must include exactly one text prompt');
  }

  if (firstFrameCount > 1) errors.push('Only one first-frame image is allowed');
  if (lastFrameCount > 1) errors.push('Only one last-frame image is allowed');
  if (lastFrameCount > 0 && firstFrameCount === 0) {
    errors.push('A last-frame image requires a first-frame image');
  }
  if (referenceImageCount > maxReferenceImages) {
    errors.push(`At most ${maxReferenceImages} reference images are allowed`);
  }
  if (referenceVideoCount > maxReferenceVideos) {
    errors.push(`At most ${maxReferenceVideos} reference videos are allowed`);
  }
  if (referenceAudioCount > maxReferenceAudio) {
    errors.push(`At most ${maxReferenceAudio} reference audio items are allowed`);
  }
  if (baseVideoCount > 1) {
    errors.push('Only one base video is allowed');
  }

  const hasFrame = firstFrameCount > 0 || lastFrameCount > 0;
  const hasReference =
    referenceImageCount > 0 || referenceVideoCount > 0 || referenceAudioCount > 0;

  if (hasFrame && hasReference) {
    errors.push('Image-to-video and reference-to-video inputs cannot be mixed');
  }

  const dataUrlBytes = resolved.reduce((total, item) => {
    if (item.type === 'text' || !item.url) return total;
    const match = DATA_URL_PATTERNS[MEDIA_KIND_BY_TYPE[item.type]].exec(item.url.trim());
    if (!match) return total;
    return total + (getDataUrlByteLength(match[2] ?? '') ?? 0);
  }, 0);

  if (dataUrlBytes > VIDEO_REQUEST_BODY_BYTE_LIMIT) {
    errors.push('Inline media must not exceed 64MB in total');
  }

  void options.model;
  return errors;
}

/* -------------------------------------------------------------------------- *
 * Request schemas
 * -------------------------------------------------------------------------- */

const GenerationBaseSchema = z.object({
  model: VideoModelSchema.default('MiniMax-H3'),
  content: z.array(VideoContentInputSchema).min(1, 'Content is required'),
  resolution: VideoResolutionSchema,
  duration: z
    .number()
    .int('Duration must be a whole number of seconds')
    .min(4, 'Duration must be at least 4 seconds')
    .max(15, 'Duration must be at most 15 seconds'),
  ratio: VideoRatioSchema.optional(),
  promptExpansionMode: VideoPromptExpansionModeSchema.optional(),
});

/**
 * Create video generation task — `POST /v2/video_generation`.
 */
export const CreateVideoGenerationSchema = GenerationBaseSchema.superRefine((value, ctx) => {
  const capabilities = VIDEO_MODEL_CAPABILITIES[value.model];

  if (!capabilities.resolutions.includes(value.resolution)) {
    ctx.addIssue({
      code: 'custom',
      path: ['resolution'],
      message: `${value.model} supports ${capabilities.resolutions.join(' and ')} resolution only`,
    });
  }

  if (value.duration < capabilities.minDuration || value.duration > capabilities.maxDuration) {
    ctx.addIssue({
      code: 'custom',
      path: ['duration'],
      message: `${value.model} supports ${capabilities.minDuration} to ${capabilities.maxDuration} second clips`,
    });
  }

  if (value.promptExpansionMode && !supportsPromptExpansionMode(value.model)) {
    ctx.addIssue({
      code: 'custom',
      path: ['promptExpansionMode'],
      message: `Prompt expansion mode is only supported by ${VIDEO_PROMPT_EXPANSION_MODELS.join(' and ')}`,
    });
  }

  for (const message of collectVideoContentErrors(value.content, {
    model: value.model,
    allowBaseVideo: false,
    requireText: true,
  })) {
    ctx.addIssue({ code: 'custom', path: ['content'], message });
  }

  const scenario = resolveVideoScenario(value.content);

  if (scenario === 'text-to-video') {
    if (value.ratio === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['ratio'],
        message: 'Text-to-video requires an explicit aspect ratio',
      });
    } else if (value.ratio === 'adaptive') {
      ctx.addIssue({
        code: 'custom',
        path: ['ratio'],
        message: 'Text-to-video cannot use the adaptive aspect ratio',
      });
    }
  }

  if (scenario === 'image-to-video' && value.ratio !== undefined && value.ratio !== 'adaptive') {
    ctx.addIssue({
      code: 'custom',
      path: ['ratio'],
      message: 'Image-to-video always uses the adaptive aspect ratio',
    });
  }

  if (
    scenario === 'reference-to-video' &&
    value.ratio === 'adaptive' &&
    !capabilities.supportsAdaptiveRatio
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['ratio'],
      message: `${value.model} requires a concrete aspect ratio for reference-to-video`,
    });
  }
}).transform((value) => ({
  ...value,
  content: resolveVideoContentRolesForRequest(value.content),
  ratio: value.ratio ?? 'adaptive',
}));

export type CreateVideoGenerationRequest = z.output<typeof CreateVideoGenerationSchema>;

/**
 * Create H3-Context-IR task — `POST /v2/h3_context_ir`.
 *
 * Context-IR only enriches a prompt; it never creates a video.
 */
export const CreateVideoContextIRSchema = z
  .object({
    model: VideoModelSchema.default(VIDEO_CONTEXT_IR_MODEL),
    content: z.array(VideoContentInputSchema).min(1, 'Content is required'),
    duration: z
      .number()
      .int('Duration must be a whole number of seconds')
      .min(4, 'Duration must be at least 4 seconds')
      .max(15, 'Duration must be at most 15 seconds'),
    ratio: VideoRatioSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.model !== VIDEO_CONTEXT_IR_MODEL) {
      ctx.addIssue({
        code: 'custom',
        path: ['model'],
        message: `Only ${VIDEO_CONTEXT_IR_MODEL} supports H3-Context-IR`,
      });
    }

    for (const message of collectVideoContentErrors(value.content, {
      model: value.model,
      allowBaseVideo: false,
      requireText: true,
    })) {
      ctx.addIssue({ code: 'custom', path: ['content'], message });
    }

    const scenario = resolveVideoScenario(value.content);

    if (scenario === 'text-to-video') {
      if (value.ratio === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['ratio'],
          message: 'Text-to-video requires an explicit aspect ratio',
        });
      } else if (value.ratio === 'adaptive') {
        ctx.addIssue({
          code: 'custom',
          path: ['ratio'],
          message: 'Text-to-video cannot use the adaptive aspect ratio',
        });
      }
    }

    if (scenario === 'image-to-video' && value.ratio !== undefined && value.ratio !== 'adaptive') {
      ctx.addIssue({
        code: 'custom',
        path: ['ratio'],
        message: 'Image-to-video always uses the adaptive aspect ratio',
      });
    }
  })
  .transform((value) => ({
    ...value,
    content: resolveVideoContentRolesForRequest(value.content),
    ratio: value.ratio ?? 'adaptive',
  }));

export type CreateVideoContextIRRequest = z.output<typeof CreateVideoContextIRSchema>;

/**
 * Create video regeneration task — `POST /v2/video_regeneration`.
 *
 * Exactly one source is accepted: an existing `sourceTaskId`, or a content
 * array carrying exactly one `base_video` item.
 */
export const CreateVideoRegenerationSchema = z
  .object({
    model: VideoModelSchema.default(VIDEO_CONTEXT_IR_MODEL),
    content: z.array(VideoRegenerationContentInputSchema).optional(),
    sourceTaskId: VideoTaskIdSchema.optional(),
    resolution: z.literal('2K').default('2K'),
    aigcWatermark: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.model !== VIDEO_CONTEXT_IR_MODEL) {
      ctx.addIssue({
        code: 'custom',
        path: ['model'],
        message: `Only ${VIDEO_CONTEXT_IR_MODEL} supports video regeneration`,
      });
    }

    const hasSourceTask = Boolean(value.sourceTaskId);
    const hasContent = Array.isArray(value.content) && value.content.length > 0;

    if (hasSourceTask && hasContent) {
      ctx.addIssue({
        code: 'custom',
        path: ['content'],
        message: 'Provide either a source task ID or a base video, not both',
      });
    }

    if (!hasSourceTask && !hasContent) {
      ctx.addIssue({
        code: 'custom',
        path: ['sourceTaskId'],
        message: 'Provide either a source task ID or a base video',
      });
    }

    if (hasContent) {
      const content = value.content ?? [];
      const errors = collectVideoContentErrors(content, {
        model: value.model,
        allowBaseVideo: true,
        requireText: false,
      });

      const baseVideoCount = content.filter(
        (item) => item.type === 'video_url' && item.role === 'base_video',
      ).length;

      if (baseVideoCount !== 1) {
        errors.push('Regeneration requires exactly one base video');
      }

      for (const message of errors) {
        ctx.addIssue({ code: 'custom', path: ['content'], message });
      }
    }
  })
  .transform((value) => ({
    ...value,
    ...(value.content
      ? { content: resolveVideoContentRolesForRequest(value.content) }
      : {}),
  }));

export type CreateVideoRegenerationRequest = z.output<typeof CreateVideoRegenerationSchema>;

/**
 * Query parameters for the shared task list endpoint.
 *
 * Numbers arrive as strings, so they are converted before the range checks
 * run. The conversion is explicit (instead of `z.coerce.number`) to keep the
 * range messages: a coerced number that fails its type check would otherwise
 * hide the "must be 1 or greater" style hints.
 */
function createPaginationSchema(label: string, fallback: number) {
  return z
    .preprocess(
      (value) => (typeof value === 'string' && value.trim() !== '' ? Number(value) : value),
      z
        .number({ error: `${label} must be a whole number` })
        .int(`${label} must be a whole number`)
        .min(1, `${label} must be 1 or greater`)
        .max(100, `${label} must be 100 or less`),
    )
    .default(fallback);
}

export const VideoListTasksQuerySchema = z.object({
  page: createPaginationSchema('Page', 1),
  pageSize: createPaginationSchema('Page size', 20),
  status: VideoTaskStatusSchema.optional(),
  taskType: VideoTaskTypeSchema.optional(),
  model: VideoModelSchema.optional(),
  taskIds: z.string().trim().min(1).optional(),
});

export type VideoListTasksQuery = z.output<typeof VideoListTasksQuerySchema>;

/* -------------------------------------------------------------------------- *
 * Normalized task DTO
 * -------------------------------------------------------------------------- */

export interface VideoTaskErrorDTO {
  code?: string | number;
  message?: string;
}

export interface VideoTaskContentDTO {
  url?: string;
  prompt?: string;
}

/**
 * Usage reported by MiniMax once a task succeeds. Video tasks report
 * seconds, H3-Context-IR tasks report tokens.
 */
export interface VideoTaskUsageDTO {
  totalSeconds?: number;
  inputSeconds?: number;
  outputSeconds?: number;
  inputImageCount?: number;
  inputAudioSeconds?: number;
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
}

/**
 * Normalized MiniMax video task.
 *
 * Times are epoch milliseconds. `content.url` is only present when the
 * provider link is a valid http(s) URL, so callers can embed it directly.
 */
export interface VideoTaskDTO {
  id: string;
  model?: string;
  status: VideoTaskStatus;
  taskType: VideoTaskType;
  modality?: VideoModality;
  content?: VideoTaskContentDTO;
  resolution?: string;
  duration?: number;
  ratio?: string;
  createdAt?: number;
  updatedAt?: number;
  error?: VideoTaskErrorDTO;
  usage?: VideoTaskUsageDTO;
}

export class VideoTaskNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VideoTaskNormalizationError';
  }
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return undefined;
}

/**
 * Converts an upstream Unix timestamp in seconds into epoch milliseconds.
 */
export function toEpochMilliseconds(seconds: unknown): number | undefined {
  const value = readOptionalNumber(seconds);
  if (value === undefined) return undefined;
  return Math.round(value * 1000);
}

function normalizeUsage(raw: unknown): VideoTaskUsageDTO | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const usage = raw as Record<string, unknown>;

  const normalized: VideoTaskUsageDTO = {
    totalSeconds: readOptionalNumber(usage.total_seconds),
    inputSeconds: readOptionalNumber(usage.input_seconds),
    outputSeconds: readOptionalNumber(usage.output_seconds),
    inputImageCount: readOptionalNumber(usage.input_image_count),
    inputAudioSeconds: readOptionalNumber(usage.input_audio_seconds),
    totalTokens: readOptionalNumber(usage.total_tokens),
    promptTokens: readOptionalNumber(usage.prompt_tokens),
    completionTokens: readOptionalNumber(usage.completion_tokens),
  };

  return Object.values(normalized).some((value) => value !== undefined) ? normalized : undefined;
}

/**
 * Maps an upstream task payload onto the normalized {@link VideoTaskDTO}.
 *
 * Unknown or missing statuses are rejected rather than coerced, so a query
 * failure can never be mistaken for a completed task.
 */
export function normalizeVideoTask(raw: unknown): VideoTaskDTO {
  if (!raw || typeof raw !== 'object') {
    throw new VideoTaskNormalizationError('MiniMax returned an invalid task payload');
  }

  const task = raw as Record<string, unknown>;

  const id = readOptionalString(task.id);
  if (!id) {
    throw new VideoTaskNormalizationError('MiniMax returned a task without an id');
  }

  const statusRaw = readOptionalString(task.status);
  if (!statusRaw || !VIDEO_TASK_STATUSES.includes(statusRaw as VideoTaskStatus)) {
    throw new VideoTaskNormalizationError(
      `MiniMax returned an unsupported task status: ${statusRaw ?? 'missing'}`,
    );
  }
  const status = statusRaw as VideoTaskStatus;

  const taskTypeRaw = readOptionalString(task.task_type);
  const taskType = taskTypeRaw && VIDEO_TASK_TYPES.includes(taskTypeRaw as VideoTaskType)
    ? (taskTypeRaw as VideoTaskType)
    : 'generation';

  const modalityRaw = readOptionalString(task.modality);
  const modality = modalityRaw && VIDEO_MODALITIES.includes(modalityRaw as VideoModality)
    ? (modalityRaw as VideoModality)
    : taskType === 'h3_context_ir' ? 'text' : 'video';

  const normalized: VideoTaskDTO = {
    id,
    status,
    taskType,
    modality,
  };

  const model = readOptionalString(task.model);
  if (model) normalized.model = model;

  const resolution = readOptionalString(task.resolution);
  if (resolution) normalized.resolution = resolution;

  const ratio = typeof task.ratio === 'string' ? task.ratio : undefined;
  if (ratio !== undefined) normalized.ratio = ratio;

  const duration = readOptionalNumber(task.duration);
  if (duration !== undefined) normalized.duration = duration;

  const createdAt = toEpochMilliseconds(task.created_at);
  if (createdAt !== undefined) normalized.createdAt = createdAt;

  const updatedAt = toEpochMilliseconds(task.updated_at);
  if (updatedAt !== undefined) normalized.updatedAt = updatedAt;

  const contentRaw = task.content;
  if (contentRaw && typeof contentRaw === 'object') {
    const content = contentRaw as Record<string, unknown>;
    const url = readOptionalString(content.url);
    const prompt = typeof content.prompt === 'string' && content.prompt.length > 0
      ? content.prompt
      : undefined;

    const normalizedContent: VideoTaskContentDTO = {};
    if (url && isSafeHttpUrl(url)) normalizedContent.url = url;
    if (prompt) normalizedContent.prompt = prompt;

    if (Object.keys(normalizedContent).length > 0) {
      normalized.content = normalizedContent;
    }
  }

  const errorRaw = task.error;
  if (errorRaw && typeof errorRaw === 'object') {
    const error = errorRaw as Record<string, unknown>;
    const code = typeof error.code === 'string' || typeof error.code === 'number'
      ? error.code
      : undefined;
    const message = typeof error.message === 'string' ? error.message : undefined;

    if (code !== undefined || message !== undefined) {
      normalized.error = {
        ...(code !== undefined ? { code } : {}),
        ...(message !== undefined ? { message } : {}),
      };
    }
  }

  const usage = normalizeUsage(task.usage);
  if (usage) normalized.usage = usage;

  return normalized;
}

/**
 * Maps an upstream list payload onto the normalized task list.
 */
export function normalizeVideoTaskList(raw: unknown): VideoListTasksResponse {
  if (!raw || typeof raw !== 'object') {
    throw new VideoTaskNormalizationError('MiniMax returned an invalid task list payload');
  }

  const payload = raw as Record<string, unknown>;
  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  const items = rawItems.map((item) => normalizeVideoTask(item));
  const total = readOptionalNumber(payload.total) ?? items.length;

  return { items, total };
}

/* -------------------------------------------------------------------------- *
 * Upstream response envelopes
 * -------------------------------------------------------------------------- */

export interface VideoCreateTaskResponse {
  taskId: string;
}

export interface VideoTaskResponse {
  task: VideoTaskDTO;
}

export interface VideoListTasksResponse {
  items: VideoTaskDTO[];
  total: number;
}

export type VideoTaskAction = 'cancelled' | 'deleted';

export interface VideoTaskActionResponse {
  taskId: string;
  action: VideoTaskAction;
  status: VideoTaskAction;
}
