/**
 * Video Agent DTOs — contratos de `POST /v1/video_template_generation` y
 * `GET /v1/query/video_template_generation`.
 *
 * Fuentes oficiales (leídas 2026-11-26):
 * - /api-reference/video-agent-create
 * - /api-reference/video-agent-query
 * - /faq/video-agent-templates
 *
 * El catálogo de templates NO es un endpoint: MiniMax lo publica en la FAQ.
 * Por eso vive acá como lista curada, versionada junto al código.
 */

import { z } from 'zod';

/* -------------------------------------------------------------------------- *
 * Catálogo de templates
 * -------------------------------------------------------------------------- */

/** Un template exige imagen, texto, o ambos. */
export interface VideoAgentTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly requiresMedia: boolean;
  readonly requiresText: boolean;
  /**
   * Exact media input count MiniMax validates for this template. The published
   * table omits it; these values were confirmed against the API, which answers
   * `2013` with `expected: N` when the count does not match.
   */
  readonly mediaCount: number;
}

/**
 * Los 16 templates oficiales, con sus IDs y requisitos.
 * Fuente: https://platform.minimax.io/docs/faq/video-agent-templates
 */
export const VIDEO_AGENT_TEMPLATES: readonly VideoAgentTemplate[] = [
  {
    id: '392747428568649728',
    name: 'Diving',
    description: 'The subject of the picture completes a perfect dive.',
    requiresMedia: true,
    requiresText: false,
    mediaCount: 1,
  },
  {
    id: '393769180141805569',
    name: 'Run for Life',
    description: 'Your pet survives in the wilderness as a wild beast.',
    requiresMedia: true,
    requiresText: true,
    mediaCount: 1,
  },
  {
    id: '397087679467597833',
    name: 'Transformers',
    description: 'A car transforms into a mecha.',
    requiresMedia: true,
    requiresText: false,
    mediaCount: 1,
  },
  {
    id: '393881433990066176',
    name: 'Still rings routine',
    description: 'The subject performs a perfect still rings routine.',
    requiresMedia: true,
    requiresText: false,
    mediaCount: 1,
  },
  {
    id: '393498001241890824',
    name: 'Weightlifting',
    description: 'Your pet performs a perfect weightlifting move.',
    requiresMedia: true,
    requiresText: false,
    mediaCount: 1,
  },
  {
    id: '393488336655310850',
    name: 'Climbing',
    description: 'The subject completes a perfect sport climbing move.',
    requiresMedia: true,
    requiresText: false,
    mediaCount: 1,
  },
  {
    id: '394514820878671878',
    name: 'Anime Life Sim',
    description: 'A casual anime-style gameplay video of the scene you describe.',
    requiresMedia: false,
    requiresText: true,
    mediaCount: 0,
  },
  {
    id: '393879757702918151',
    name: "McDonald's Delivery Pet",
    description: "Your pet becomes a McDonald's delivery pet.",
    requiresMedia: true,
    requiresText: false,
    mediaCount: 1,
  },
  {
    id: '397017167949312007',
    name: 'Pet Pilot',
    description: 'Your pet pilots a fighter jet.',
    requiresMedia: true,
    requiresText: false,
    mediaCount: 1,
  },
  {
    id: '394176968202485769',
    name: 'Miniature Set Ad',
    description: 'A miniature figure crafting process video of your product.',
    requiresMedia: true,
    requiresText: false,
    mediaCount: 1,
  },
  {
    id: '393876118804459526',
    name: 'Male Model Try-On Ad',
    description: 'A male model try-on ad with the clothing you upload.',
    requiresMedia: true,
    requiresText: false,
    mediaCount: 1,
  },
  {
    id: '393866076583718914',
    name: 'Female Model Try-On Ad',
    description: 'A female model try-on ad with the clothing you upload.',
    requiresMedia: true,
    requiresText: false,
    mediaCount: 1,
  },
  {
    id: '394875727173492739',
    name: 'Art Fonts',
    description: 'Artistic decorative text made of the element you choose.',
    requiresMedia: false,
    requiresText: true,
    mediaCount: 0,
  },
  {
    id: '394220989629177861',
    name: 'Drinkfall',
    description: 'A drink waterfall video of your beverage.',
    requiresMedia: true,
    requiresText: false,
    mediaCount: 1,
  },
  {
    // The published table says no media and required text, but the API expects
    // one image and zero text inputs (confirmed 2026-11-28).
    id: '393853165953970178',
    name: 'E-commerce Display Ad',
    description: 'A minimalist e-commerce display video of your product.',
    requiresMedia: true,
    requiresText: false,
    mediaCount: 1,
  },
  {
    id: '401431836934868999',
    name: '3D character product presentation',
    description: 'A custom 3D character explaining your product.',
    requiresMedia: true,
    requiresText: true,
    mediaCount: 3,
  },
];

export const VIDEO_AGENT_TEMPLATE_IDS = VIDEO_AGENT_TEMPLATES.map((template) => template.id);

export function findVideoAgentTemplate(templateId: string): VideoAgentTemplate | undefined {
  return VIDEO_AGENT_TEMPLATES.find((template) => template.id === templateId);
}

/* -------------------------------------------------------------------------- *
 * Vocabularios
 * -------------------------------------------------------------------------- */

/**
 * Estados del task. La API usa mayúsculas (`Preparing`, `Processing`,
 * `Success`, `Fail`); acá se normalizan a minúsculas.
 */
export const VIDEO_AGENT_TASK_STATUSES = [
  'preparing',
  'processing',
  'succeeded',
  'failed',
] as const;
export type VideoAgentTaskStatus = (typeof VIDEO_AGENT_TASK_STATUSES)[number];
export const VideoAgentTaskStatusSchema = z.enum(VIDEO_AGENT_TASK_STATUSES);

/* -------------------------------------------------------------------------- *
 * Límites de media
 * -------------------------------------------------------------------------- */

const MB = 1024 * 1024;

/** Tope por archivo de media. */
export const VIDEO_AGENT_MAX_MEDIA_BYTES = 20 * MB;
export const VIDEO_AGENT_MAX_MEDIA_MB = 20;

/** Formatos de imagen admitidos. */
export const VIDEO_AGENT_MEDIA_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;

const DATA_URL_PATTERN = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/i;
const MM_FILE_PATTERN = /^mm_file:\/\/(\d+)$/;

/**
 * Valida una referencia de media sin tocar la red: el server nunca descarga
 * una URL del usuario.
 *
 * Devuelve el mensaje de error, o null cuando la referencia es aceptable.
 */
export function validateTemplateMediaReference(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return 'The media reference is required';
  }

  if (MM_FILE_PATTERN.test(trimmed)) {
    return null;
  }

  const dataUrlMatch = DATA_URL_PATTERN.exec(trimmed);
  if (dataUrlMatch) {
    const payload = dataUrlMatch[2] ?? '';
    if (payload.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) {
      return 'The media data URL payload is not valid Base64';
    }
    const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
    const bytes = (payload.length / 4) * 3 - padding;
    if (bytes > VIDEO_AGENT_MAX_MEDIA_BYTES) {
      return `The media must be ${VIDEO_AGENT_MAX_MEDIA_MB}MB or smaller`;
    }
    return null;
  }

  if (/^data:/i.test(trimmed)) {
    return 'The media must be a JPEG, PNG or WebP data URL';
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return 'The media reference must be an http(s) URL, an mm_file:// reference, or a data URL';
    }
    if (url.username.length > 0 || url.password.length > 0) {
      return 'The media reference must not carry credentials';
    }
    return null;
  } catch {
    return 'The media reference must be an http(s) URL, an mm_file:// reference, or a data URL';
  }
}

/* -------------------------------------------------------------------------- *
 * Request
 * -------------------------------------------------------------------------- */

export const VideoAgentTextInputSchema = z.object({
  value: z.string().min(1, 'The text input is required'),
});

export const VideoAgentMediaInputSchema = z.object({
  value: z.string().min(1, 'The media input is required'),
});

export const CreateVideoAgentTaskSchema = z
  .object({
    templateId: z.string().min(1, 'templateId is required'),
    textInputs: z.array(VideoAgentTextInputSchema).default([]),
    mediaInputs: z.array(VideoAgentMediaInputSchema).default([]),
    /**
     * URL donde MiniMax manda las actualizaciones de estado. Requiere que el
     * receptor conteste el `challenge` en 3 segundos; la app no expone un
     * endpoint de verificación, así que apunta a un receptor propio.
     */
    callbackUrl: z.string().url('callbackUrl must be an absolute URL').optional(),
  })
  .superRefine((value, ctx) => {
    const template = findVideoAgentTemplate(value.templateId);
    if (!template) {
      ctx.addIssue({
        code: 'custom',
        path: ['templateId'],
        message: 'Unknown template ID',
      });
      return;
    }

    if (template.requiresMedia && value.mediaInputs.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['mediaInputs'],
        message: `The "${template.name}" template needs a media input`,
      });
    } else if (value.mediaInputs.length !== template.mediaCount) {
      ctx.addIssue({
        code: 'custom',
        path: ['mediaInputs'],
        message: template.mediaCount === 0
          ? `The "${template.name}" template does not take images`
          : `The "${template.name}" template needs exactly ${template.mediaCount} images`,
      });
    }

    if (template.requiresText && value.textInputs.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['textInputs'],
        message: `The "${template.name}" template needs a text input`,
      });
    } else if (!template.requiresText && value.textInputs.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['textInputs'],
        message: `The "${template.name}" template does not take text inputs`,
      });
    }

    value.mediaInputs.forEach((input, index) => {
      const error = validateTemplateMediaReference(input.value);
      if (error) {
        ctx.addIssue({ code: 'custom', path: ['mediaInputs', index, 'value'], message: error });
      }
    });
  });

export type CreateVideoAgentTaskRequest = z.output<typeof CreateVideoAgentTaskSchema>;

/* -------------------------------------------------------------------------- *
 * Response
 * -------------------------------------------------------------------------- */

/** Task creado. */
export interface VideoAgentTaskCreatedDTO {
  taskId: string;
}

/** Task consultado. */
export interface VideoAgentTaskDTO {
  taskId: string;
  status: VideoAgentTaskStatus;
  /** URL de descarga; válida por 9 horas. */
  videoUrl?: string;
  error?: { code?: string | number; message?: string };
}

/**
 * Normaliza el estado que devuelve la API (`Preparing`, `Processing`,
 * `Success`, `Fail`) al vocabulario de la app.
 */
export function normalizeVideoAgentStatus(value: unknown): VideoAgentTaskStatus {
  switch (typeof value === 'string' ? value.trim().toLowerCase() : '') {
    case 'preparing':
      return 'preparing';
    case 'processing':
      return 'processing';
    case 'success':
      return 'succeeded';
    case 'fail':
    case 'failed':
      return 'failed';
    default:
      return 'processing';
  }
}
