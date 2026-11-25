/**
 * MiniMax H3 image HTTP client.
 * Server-only: never imported from client-side code.
 *
 * Endpoints (https://platform.minimax.io/docs/api-reference/image-generation-h3-generations.md):
 * - POST /v1/images/generations  — text-to-image
 * - POST /v1/images/edits        — image edit with 1 to 16 reference images
 * - POST /v1/h3_image_context_ir — prompt enhancement only, no image output
 *
 * These endpoints are not idempotent: the server finishes the generation and
 * bills the successful images even when the client times out or disconnects.
 * Automatic retries are therefore disabled, and the client timeout matches the
 * documented 600 second server window.
 */

import 'server-only';

import {
  hasExplicitSize,
  IMAGE_MODEL,
  IMAGE_RESPONSE_OUTPUT_FORMATS,
  isImageEditRequest,
  type GenerateImageRequest,
  type GenerateImageResponse,
  type ImageContextIRRequest,
  type ImageContextIRResponse,
  type ImageResultItem,
  type ImageUsage,
} from '@/application/dto/ImageDTO';
import {
  buildAuthHeader,
  MINIMAX_BASE_URL,
  parseMiniMaxApplicationError,
  parseMiniMaxError,
  parseRetryAfterSeconds,
  requireMiniMaxApiKey,
  type MiniMaxApiError,
} from './MiniMaxConfig';
import { readResponseBodyOnce } from './retry-utils';

export class MiniMaxImageError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly status?: number,
    public readonly retryAfterSeconds?: number,
    /** Per-item failures reported by the provider, when the response carried them. */
    public readonly failures?: Array<{ code: string | null; message: string }>
  ) {
    super(message);
    this.name = 'MiniMaxImageError';
  }
}

/** Documented server window. The client must not give up before the server does. */
const FETCH_TIMEOUT_MS = 600_000;

const IMAGE_GENERATIONS_PATH = '/v1/images/generations';
const IMAGE_EDITS_PATH = '/v1/images/edits';
const IMAGE_CONTEXT_IR_PATH = '/v1/h3_image_context_ir';

type ResponseOutputFormat = (typeof IMAGE_RESPONSE_OUTPUT_FORMATS)[number];

interface MiniMaxH3ImageItem {
  url?: string;
  b64_json?: string;
  size?: string;
  revised_prompt?: string;
  error?: { code?: string; message?: string };
}

interface MiniMaxH3Usage {
  generated_images?: number;
  total_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
}

interface MiniMaxH3ImagesPayload {
  created?: number;
  data?: MiniMaxH3ImageItem[];
  output_format?: string;
  usage?: MiniMaxH3Usage;
  request_id?: string;
  /** Legacy envelope: application errors reported inside a 200 response. */
  base_resp?: { status_code?: number; status_msg?: string };
}

interface MiniMaxH3StreamEvent {
  type?: string;
  created?: number;
  model?: string;
  image_index?: number;
  url?: string;
  size?: string;
  output_format?: string;
  revised_prompt?: string;
  code?: string;
  message?: string;
  usage?: MiniMaxH3Usage;
  request_id?: string;
  error?: { type?: string; message?: string; http_code?: string };
}

interface MiniMaxH3ContextIRPayload {
  created?: number;
  revised_prompt?: string;
  aspect_ratio?: string;
  usage?: { total_tokens?: number; input_tokens?: number };
  request_id?: string;
  /** Legacy envelope: application errors reported inside a 200 response. */
  base_resp?: { status_code?: number; status_msg?: string };
}

function normalizeError(apiError: MiniMaxApiError): MiniMaxImageError {
  return new MiniMaxImageError(apiError.message, apiError.code, apiError.status, apiError.retryAfterSeconds);
}

/** Abort errors are not always `Error` instances across runtimes. */
function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError';
}

/**
 * Parses the MiniMax-H3-Image error envelope (`{ type, error: { message, http_code } }`)
 * and still understands the legacy `base_resp` envelope.
 */
function parseH3ImageError(response: Response, body: unknown): MiniMaxApiError {
  const raw = body as Record<string, unknown> | undefined;
  const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get('retry-after'));

  const errorDetail = raw?.error;
  if (errorDetail && typeof errorDetail === 'object') {
    const detail = errorDetail as { message?: unknown; http_code?: unknown };
    const message = typeof detail.message === 'string' && detail.message.length > 0
      ? detail.message
      : 'MiniMax image request failed';
    const httpCode = typeof detail.http_code === 'string' ? Number(detail.http_code) : Number.NaN;
    const code = Number.isFinite(httpCode) ? httpCode : response.status;
    return { code, message, status: response.status, retryAfterSeconds };
  }

  const baseResp = raw?.base_resp;
  if (baseResp && typeof baseResp === 'object') {
    const legacy = baseResp as { status_code?: unknown; status_msg?: unknown };
    if (typeof legacy.status_code === 'number') {
      return parseMiniMaxApplicationError(response.status, {
        status_code: legacy.status_code,
        status_msg: typeof legacy.status_msg === 'string' ? legacy.status_msg : undefined,
      });
    }
  }

  return parseMiniMaxError(response, body);
}

/**
 * The legacy image envelope reported application errors inside a 200 response
 * through `base_resp`. The current endpoints use HTTP status codes, but the
 * legacy shape is still honoured so old workflows keep failing loudly.
 */
function throwOnApplicationError(payload: { base_resp?: { status_code?: number; status_msg?: string } } | undefined): void {
  const baseResp = payload?.base_resp;
  if (!baseResp || typeof baseResp.status_code !== 'number' || baseResp.status_code === 0) return;

  throw normalizeError(parseMiniMaxApplicationError(200, {
    status_code: baseResp.status_code,
    status_msg: baseResp.status_msg,
  }));
}

function normalizeOutputFormat(value: string | undefined, fallback: string): ResponseOutputFormat {
  const normalized = (value ?? fallback).toLowerCase();
  if (normalized === 'png') return 'png';
  if (normalized === 'webp') return 'webp';
  return 'jpeg';
}

function mapUsage(usage: MiniMaxH3Usage | undefined): ImageUsage | null {
  if (!usage) return null;
  return {
    generatedImages: usage.generated_images ?? 0,
    totalTokens: usage.total_tokens ?? 0,
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
  };
}

function mapImageItems(items: MiniMaxH3ImageItem[]): ImageResultItem[] {
  return items.map((item, index) => ({
    index,
    url: typeof item.url === 'string' && item.url.length > 0 ? item.url : null,
    size: typeof item.size === 'string' && item.size.length > 0 ? item.size : null,
    revisedPrompt: typeof item.revised_prompt === 'string' && item.revised_prompt.length > 0
      ? item.revised_prompt
      : null,
    error: item.error
      ? {
          code: typeof item.error.code === 'string' ? item.error.code : null,
          message: item.error.message ?? 'Image generation failed',
        }
      : null,
  }));
}

function buildImageResponse(input: {
  items: ImageResultItem[];
  outputFormat: ResponseOutputFormat;
  requestId: string | null;
  created: number | null;
  usage: ImageUsage | null;
}): GenerateImageResponse {
  const { items } = input;
  const imageUrls = items
    .filter((item) => item.url !== null)
    .map((item) => item.url as string);
  const successCount = items.filter((item) => item.url !== null && item.error === null).length;
  const failedCount = items.filter((item) => item.error !== null).length;

  if (items.length > 0 && successCount === 0) {
    const failures = items
      .filter((item) => item.error !== null)
      .map((item) => ({ code: item.error?.code ?? null, message: item.error?.message ?? 'Image generation failed' }));
    const firstFailure = failures[0];
    throw new MiniMaxImageError(
      firstFailure?.message ?? 'MiniMax generated no images',
      Number(firstFailure?.code ?? 0) || 502,
      502,
      undefined,
      failures,
    );
  }

  if (imageUrls.length === 0) {
    throw new MiniMaxImageError('MiniMax returned no image URLs', 0, 502);
  }

  return {
    id: input.requestId ?? crypto.randomUUID(),
    imageUrls,
    images: items,
    metadata: {
      successCount,
      failedCount,
      totalCount: items.length,
      outputFormat: input.outputFormat,
      requestId: input.requestId,
      created: input.created,
      usage: input.usage,
    },
    // The current image endpoints document no retention window for the returned URLs.
    expiresAt: null,
  };
}

function buildImageRequestBody(request: GenerateImageRequest): Record<string, unknown> {
  const isEdit = isImageEditRequest(request);
  const body: Record<string, unknown> = {
    model: request.model,
    prompt: request.prompt,
    n: request.n,
    output_format: request.outputFormat,
    response_format: request.responseFormat,
    output_compression: request.outputCompression,
    stream: request.stream,
  };

  if (hasExplicitSize(request.size)) {
    // An explicit size cannot be combined with aspect_ratio or area.
    body.size = request.size;
  } else {
    body.size = 'auto';
    body.aspect_ratio = request.aspectRatio ?? 'auto';
    body.area = request.area ?? '4K';
  }

  if (!isEdit) {
    // Image edits always enhance the prompt; the edit endpoint has no disable flag.
    body.disable_prompt_enhanced = request.disablePromptEnhanced;
  }

  if (isEdit) {
    body.images = (request.images ?? []).map((reference) => ({ image_url: reference.imageUrl }));
  }

  return body;
}

function parseSseChunk(chunk: string): MiniMaxH3StreamEvent | null {
  const dataLines = chunk
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trimStart());

  if (dataLines.length === 0) return null;

  try {
    const parsed: unknown = JSON.parse(dataLines.join('\n'));
    return parsed && typeof parsed === 'object' ? (parsed as MiniMaxH3StreamEvent) : null;
  } catch {
    return null;
  }
}

/** Reads the Server-Sent Events stream pushed when `stream` is enabled. */
async function* readSseEvents(response: Response): AsyncGenerator<MiniMaxH3StreamEvent> {
  const body = response.body;
  if (!body) return;

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const event = parseSseChunk(chunk);
      if (event) yield event;
      boundary = buffer.indexOf('\n\n');
    }
  }

  const trailing = parseSseChunk(buffer);
  if (trailing) yield trailing;
}

function mapStreamEvents(events: MiniMaxH3StreamEvent[], fallbackFormat: string): GenerateImageResponse {
  const items = new Map<number, ImageResultItem>();
  let usage: ImageUsage | null = null;
  let requestId: string | null = null;
  let created: number | null = null;
  let outputFormat = normalizeOutputFormat(fallbackFormat, fallbackFormat);

  for (const event of events) {
    const type = event.type ?? '';

    if (type === 'error') {
      const httpCode = event.error?.http_code ? Number(event.error.http_code) : Number.NaN;
      const status = Number.isFinite(httpCode) ? httpCode : 500;
      throw new MiniMaxImageError(
        event.error?.message ?? 'MiniMax image request failed',
        status,
        status,
      );
    }

    if (type.endsWith('.completed')) {
      usage = mapUsage(event.usage);
      requestId = event.request_id ?? requestId;
      created = event.created ?? created;
      continue;
    }

    if (type.endsWith('.partial_succeeded')) {
      const index = event.image_index ?? items.size;
      items.set(index, {
        index,
        url: event.url ?? null,
        size: event.size ?? null,
        revisedPrompt: event.revised_prompt ?? null,
        error: null,
      });
      if (event.output_format) {
        outputFormat = normalizeOutputFormat(event.output_format, outputFormat);
      }
      continue;
    }

    if (type.endsWith('.partial_failed')) {
      const index = event.image_index ?? items.size;
      items.set(index, {
        index,
        url: null,
        size: null,
        revisedPrompt: null,
        error: {
          code: event.code ?? null,
          message: event.message ?? 'Image generation failed',
        },
      });
    }
  }

  const orderedItems = Array.from(items.values()).sort((left, right) => left.index - right.index);

  return buildImageResponse({
    items: orderedItems,
    outputFormat,
    requestId,
    created,
    usage,
  });
}

export class MiniMaxImageClient {
  private readonly apiKey: string;

  constructor() {
    this.apiKey = requireMiniMaxApiKey();
  }

  async generateImage(request: GenerateImageRequest): Promise<GenerateImageResponse> {
    const isEdit = isImageEditRequest(request);
    const url = `${MINIMAX_BASE_URL}${isEdit ? IMAGE_EDITS_PATH : IMAGE_GENERATIONS_PATH}`;
    const body = buildImageRequestBody(request);

    return this.withUpstream(url, body, async (response) => {
      if (request.stream) {
        const events: MiniMaxH3StreamEvent[] = [];
        for await (const event of readSseEvents(response)) {
          events.push(event);
        }
        return mapStreamEvents(events, request.outputFormat);
      }

      const payload = (await response.json()) as MiniMaxH3ImagesPayload;
      throwOnApplicationError(payload);
      const items = mapImageItems(payload.data ?? []);

      return buildImageResponse({
        items,
        outputFormat: normalizeOutputFormat(payload.output_format, request.outputFormat),
        requestId: payload.request_id ?? null,
        created: payload.created ?? null,
        usage: mapUsage(payload.usage),
      });
    });
  }

  async enhanceImagePrompt(request: ImageContextIRRequest): Promise<ImageContextIRResponse> {
    const url = `${MINIMAX_BASE_URL}${IMAGE_CONTEXT_IR_PATH}`;
    const body: Record<string, unknown> = {
      model: request.model ?? IMAGE_MODEL,
      prompt: request.prompt,
    };

    if (request.images?.length) {
      body.images = request.images.map((reference) => ({ image_url: reference.imageUrl }));
    }
    if (hasExplicitSize(request.size)) {
      body.size = request.size;
    } else {
      if (request.aspectRatio !== undefined) body.aspect_ratio = request.aspectRatio;
      if (request.area !== undefined) body.area = request.area;
    }

    return this.withUpstream(url, body, async (response) => {
      const payload = (await response.json()) as MiniMaxH3ContextIRPayload;
      throwOnApplicationError(payload);

      return {
        revisedPrompt: payload.revised_prompt ?? '',
        aspectRatio: payload.aspect_ratio ?? null,
        requestId: payload.request_id ?? null,
        created: payload.created ?? null,
        usage: payload.usage
          ? {
              totalTokens: payload.usage.total_tokens ?? 0,
              inputTokens: payload.usage.input_tokens ?? 0,
            }
          : null,
      };
    });
  }

  /**
   * Performs the upstream call without retries: a retry would generate and
   * bill a second set of images.
   */
  private async withUpstream<T>(
    url: string,
    body: Record<string, unknown>,
    handler: (response: Response) => Promise<T>
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: buildAuthHeader(this.apiKey),
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorBody = await readResponseBodyOnce(response);
        throw normalizeError(parseH3ImageError(response, errorBody));
      }

      return await handler(response);
    } catch (error) {
      if (error instanceof MiniMaxImageError) throw error;
      if (isAbortError(error)) {
        throw new MiniMaxImageError('Request timed out', 0, 408);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
