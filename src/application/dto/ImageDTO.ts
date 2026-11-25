import { z } from 'zod';

/**
 * MiniMax-H3-Image request contract.
 *
 * Source of truth:
 * - https://platform.minimax.io/docs/api-reference/image-generation-h3-generations.md
 * - https://platform.minimax.io/docs/api-reference/image-generation-h3-edits.md
 * - https://platform.minimax.io/docs/api-reference/image-generation-h3-context-ir.md
 * - https://platform.minimax.io/docs/api-reference/image-generation-h3-streaming.md
 */

/** Default text-to-image / image-edit model. */
export const IMAGE_MODEL = 'MiniMax-H3-Image' as const;
/** High-speed variant. Same parameters and limits as {@link IMAGE_MODEL}. */
export const IMAGE_HIGH_SPEED_MODEL = 'MiniMax-H3-Image-Highspeed' as const;
/** Models accepted by the generation and edit endpoints. */
export const IMAGE_MODELS = [IMAGE_MODEL, IMAGE_HIGH_SPEED_MODEL] as const;

/** Output area levels. `1K`/`2K`/`4K` target 1024/2048/4096 squared pixels. */
export const IMAGE_AREAS = ['1K', '2K', '4K'] as const;

/** Output formats accepted in a request. `jpg` is an alias of `jpeg`. */
export const IMAGE_OUTPUT_FORMATS = ['png', 'jpeg', 'jpg', 'webp'] as const;

/** Output formats the provider reports back for generated images. */
export const IMAGE_RESPONSE_OUTPUT_FORMATS = ['png', 'jpeg', 'webp'] as const;

/** Prompt limit for the current image endpoints. */
export const IMAGE_PROMPT_MAX_LENGTH = 32_000;

/** Reference images per request: 1 to 16. */
export const IMAGE_MAX_REFERENCE_IMAGES = 16;

/** Maximum size of a single reference image. */
export const IMAGE_MAX_REFERENCE_BYTES = 64 * 1024 * 1024;

/**
 * The encoded request body must stay at or below 64 MiB. Base64 inflates the
 * binary payload by roughly 4/3, so the decoded reference bytes are capped at
 * 48 MiB to leave room for the JSON envelope.
 */
export const IMAGE_MAX_REFERENCE_PAYLOAD_BYTES = 48 * 1024 * 1024;

/** Minimum output area in pixels for an explicit `WIDTHxHEIGHT` size. */
export const IMAGE_MIN_OUTPUT_AREA = 655_360;

/** Maximum output area in pixels for an explicit `WIDTHxHEIGHT` size. */
export const IMAGE_MAX_OUTPUT_AREA = 20_000_000;

/** Narrowest supported aspect ratio (1:3). */
export const IMAGE_MIN_ASPECT_RATIO = 1 / 3;

/** Widest supported aspect ratio (3:1). */
export const IMAGE_MAX_ASPECT_RATIO = 3;

/** Longest side of the supported aspect ratio components. */
export const IMAGE_MAX_ASPECT_RATIO_COMPONENT = 300;

const ASPECT_RATIO_PATTERN = /^(\d{1,3}):(\d{1,3})$/;
const SIZE_PATTERN = /^(\d+)x(\d+)$/;
const REFERENCE_IMAGE_DATA_URL_PATTERN = /^data:image\/(jpeg|jpg|png|webp|heic|heif);base64,([A-Za-z0-9+/]+={0,2})$/;
const MM_FILE_PATTERN = /^mm_file:\/\/[A-Za-z0-9._-]+$/;
const PUBLIC_URL_PATTERN = /^https?:\/\/[^\s]+$/i;

const RATIO_EPSILON = 1e-9;

function isRatioWithinBounds(ratio: number): boolean {
  return ratio >= IMAGE_MIN_ASPECT_RATIO - RATIO_EPSILON && ratio <= IMAGE_MAX_ASPECT_RATIO + RATIO_EPSILON;
}

/** Parses an `X:Y` aspect ratio. Returns null when the value is not a valid ratio. */
export function parseAspectRatio(value: string): { width: number; height: number } | null {
  const match = ASPECT_RATIO_PATTERN.exec(value);
  if (!match) return null;

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isInteger(width) || !Number.isInteger(height)) return null;
  if (width < 1 || width > IMAGE_MAX_ASPECT_RATIO_COMPONENT) return null;
  if (height < 1 || height > IMAGE_MAX_ASPECT_RATIO_COMPONENT) return null;

  return { width, height };
}

/** Parses an explicit `WIDTHxHEIGHT` size. Returns null when the value is not a valid size. */
export function parseExplicitSize(value: string): { width: number; height: number } | null {
  const match = SIZE_PATTERN.exec(value);
  if (!match) return null;

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isInteger(width) || !Number.isInteger(height)) return null;
  if (width <= 0 || height <= 0) return null;

  return { width, height };
}

function getReferenceImageByteLength(value: string): number | null {
  const match = REFERENCE_IMAGE_DATA_URL_PATTERN.exec(value);
  if (!match) return null;

  const base64 = match[2] ?? '';
  if (base64.length === 0 || base64.length % 4 !== 0) return null;

  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return (base64.length / 4) * 3 - padding;
}

export const ImageModelSchema = z.enum(IMAGE_MODELS, {
  error: `Model must be one of ${IMAGE_MODELS.join(', ')}`,
});

export const ImageAreaSchema = z.enum(IMAGE_AREAS, {
  error: `Area must be one of ${IMAGE_AREAS.join(', ')}`,
});

export const ImageOutputFormatSchema = z.enum(IMAGE_OUTPUT_FORMATS, {
  error: `Output format must be one of ${IMAGE_OUTPUT_FORMATS.join(', ')}`,
});

export const ImageAspectRatioSchema = z.string().refine(
  (value) => {
    if (value === 'auto') return true;
    const parsed = parseAspectRatio(value);
    return parsed !== null && isRatioWithinBounds(parsed.width / parsed.height);
  },
  'Aspect ratio must be "auto" or X:Y with X and Y between 1 and 300 and a ratio between 1:3 and 3:1',
);

export const ImageSizeSchema = z.string().refine(
  (value) => {
    if (value === 'auto') return true;
    const parsed = parseExplicitSize(value);
    if (!parsed) return false;

    const area = parsed.width * parsed.height;
    if (area < IMAGE_MIN_OUTPUT_AREA || area > IMAGE_MAX_OUTPUT_AREA) return false;

    return isRatioWithinBounds(parsed.width / parsed.height);
  },
  'Size must be "auto" or WIDTHxHEIGHT with an area between 655,360 and 20,000,000 pixels and an aspect ratio between 1:3 and 3:1',
);

export const ImageReferenceSchema = z.object({
  imageUrl: z
    .string()
    .min(1, 'Reference image URL is required')
    .refine((value) => {
      if (REFERENCE_IMAGE_DATA_URL_PATTERN.test(value)) {
        const byteLength = getReferenceImageByteLength(value);
        return byteLength !== null && byteLength < IMAGE_MAX_REFERENCE_BYTES;
      }
      if (MM_FILE_PATTERN.test(value)) return true;
      return PUBLIC_URL_PATTERN.test(value);
    }, 'Reference image must be a public URL, an mm_file:// file id, or a JPG, PNG, WEBP, HEIC or HEIF Data URL smaller than 64MB'),
});

/** True when the request carries an explicit `WIDTHxHEIGHT` size. */
export function hasExplicitSize(size: string | undefined): boolean {
  return size !== undefined && size !== 'auto';
}

/** True when the request asks for an image edit (1 to 16 reference images). */
export function isImageEditRequest(request: { images?: unknown[] }): boolean {
  return Array.isArray(request.images) && request.images.length > 0;
}

/**
 * Generation and edit request.
 *
 * The object is strict on purpose: legacy image-01 options (`seed`,
 * `promptOptimizer`, `subjectReference`) are rejected instead of being
 * silently dropped, because the current endpoints do not implement them.
 */
export const GenerateImageSchema = z
  .object({
    model: ImageModelSchema.default(IMAGE_MODEL),
    prompt: z
      .string()
      .trim()
      .min(1, 'Prompt is required')
      .max(IMAGE_PROMPT_MAX_LENGTH, `Prompt must be at most ${IMAGE_PROMPT_MAX_LENGTH.toLocaleString('en-US')} characters`),
    n: z
      .number()
      .int('Image count must be a whole number')
      .min(1, 'Image count must be at least 1')
      .max(10, 'Image count must be at most 10')
      .default(1),
    size: ImageSizeSchema.optional(),
    aspectRatio: ImageAspectRatioSchema.optional(),
    area: ImageAreaSchema.optional(),
    outputFormat: ImageOutputFormatSchema.default('jpeg'),
    responseFormat: z
      .literal('url', { error: 'Only the url response format is supported because Library assets store provider URLs' })
      .default('url'),
    outputCompression: z
      .number()
      .int('Output compression must be a whole number')
      .min(0, 'Output compression must be at least 0')
      .max(100, 'Output compression must be at most 100')
      .default(95),
    disablePromptEnhanced: z.boolean().default(false),
    stream: z.boolean().default(false),
    images: z
      .array(ImageReferenceSchema)
      .min(1, 'At least one reference image is required')
      .max(IMAGE_MAX_REFERENCE_IMAGES, `At most ${IMAGE_MAX_REFERENCE_IMAGES} reference images are supported`)
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const explicitSize = hasExplicitSize(value.size);
    const isEdit = isImageEditRequest(value);

    if (explicitSize) {
      if (value.aspectRatio !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['aspectRatio'],
          message: 'Aspect ratio cannot be combined with an explicit width x height size',
        });
      }
      if (value.area !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['area'],
          message: 'Area cannot be combined with an explicit width x height size',
        });
      }
    }

    if (value.disablePromptEnhanced) {
      if (isEdit) {
        ctx.addIssue({
          code: 'custom',
          path: ['disablePromptEnhanced'],
          message: 'Prompt enhancement cannot be disabled for image edits; the edit endpoint always enhances the prompt',
        });
      } else if (!explicitSize && (value.aspectRatio === undefined || value.aspectRatio === 'auto')) {
        ctx.addIssue({
          code: 'custom',
          path: ['aspectRatio'],
          message: 'Disable prompt enhancement requires an explicit width x height size or a fixed X:Y aspect ratio',
        });
      }
    }

    if (value.images) {
      let payloadBytes = 0;
      for (const reference of value.images) {
        payloadBytes += getReferenceImageByteLength(reference.imageUrl) ?? 0;
      }
      if (payloadBytes > IMAGE_MAX_REFERENCE_PAYLOAD_BYTES) {
        ctx.addIssue({
          code: 'custom',
          path: ['images'],
          message: 'Reference images must stay under 48MB in total so the encoded request body stays within the 64MB limit',
        });
      }
    }
  });

export type GenerateImageRequest = z.infer<typeof GenerateImageSchema>;

/** Per-item result. Failed items only carry the provider error. */
export interface ImageResultItem {
  index: number;
  url: string | null;
  size: string | null;
  revisedPrompt: string | null;
  error: { code: string | null; message: string } | null;
}

export interface ImageUsage {
  generatedImages: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
}

export interface GenerateImageResponse {
  id: string;
  imageUrls: string[];
  images: ImageResultItem[];
  metadata: {
    successCount: number;
    failedCount: number;
    totalCount: number;
    outputFormat: (typeof IMAGE_RESPONSE_OUTPUT_FORMATS)[number];
    requestId: string | null;
    created: number | null;
    usage: ImageUsage | null;
  };
  /**
   * Expiry of the provider URLs. The current image endpoints document no
   * retention window, so this stays null instead of inventing a TTL.
   */
  expiresAt: number | null;
}

/**
 * Prompt enhancement request for the Context-IR endpoint.
 * Only `MiniMax-H3-Image` is supported there; the highspeed model returns 400.
 */
export const ImageContextIRRequestSchema = z
  .object({
    model: z.literal(IMAGE_MODEL, {
      error: 'The context IR endpoint only supports MiniMax-H3-Image',
    }).default(IMAGE_MODEL),
    prompt: z
      .string()
      .trim()
      .min(1, 'Prompt is required')
      .max(IMAGE_PROMPT_MAX_LENGTH, `Prompt must be at most ${IMAGE_PROMPT_MAX_LENGTH.toLocaleString('en-US')} characters`),
    images: z
      .array(ImageReferenceSchema)
      .min(1, 'At least one reference image is required')
      .max(IMAGE_MAX_REFERENCE_IMAGES, `At most ${IMAGE_MAX_REFERENCE_IMAGES} reference images are supported`)
      .optional(),
    size: ImageSizeSchema.optional(),
    aspectRatio: ImageAspectRatioSchema.optional(),
    area: ImageAreaSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!hasExplicitSize(value.size)) return;

    if (value.aspectRatio !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['aspectRatio'],
        message: 'Aspect ratio cannot be combined with an explicit width x height size',
      });
    }
    if (value.area !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['area'],
        message: 'Area cannot be combined with an explicit width x height size',
      });
    }
  });

export type ImageContextIRRequest = z.infer<typeof ImageContextIRRequestSchema>;

export interface ImageContextIRResponse {
  revisedPrompt: string;
  aspectRatio: string | null;
  requestId: string | null;
  created: number | null;
  usage: { totalTokens: number; inputTokens: number } | null;
}
