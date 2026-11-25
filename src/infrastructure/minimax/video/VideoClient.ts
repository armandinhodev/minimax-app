/**
 * MiniMax Video HTTP client.
 *
 * Covers the whole H3 video surface: generation, H3-Context-IR, regeneration,
 * plus the shared task query, list and cancel/delete endpoints.
 *
 * Server-only: never imported from client-side code.
 * @server-only
 */

import 'server-only';

import { VideoTaskIdSchema, normalizeVideoTask, normalizeVideoTaskList, type CreateVideoContextIRRequest, type CreateVideoGenerationRequest, type CreateVideoRegenerationRequest, type VideoContentInput, type VideoCreateTaskResponse, type VideoListTasksResponse, type VideoTaskActionResponse, type VideoTaskResponse } from '@/application/dto/minimax/video/VideoDTO';
import type { IVideoClient, VideoListTasksParams } from '@/domain/interfaces/minimax/video/IVideoClient';

import { MINIMAX_BASE_URL, buildAuthHeader, parseMiniMaxApplicationError, parseMiniMaxError, parseRetryAfterSeconds, requireMiniMaxApiKey, type MiniMaxApiError } from '../MiniMaxConfig';
import { emitUpstreamRetryTelemetry, readResponseBodyOnce } from '../retry-utils';

/**
 * Error raised for every failed MiniMax video call.
 */
export class MiniMaxVideoError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly status?: number,
    public readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'MiniMaxVideoError';
  }
}

const CREATE_TIMEOUT_MS = 60_000;
const READ_TIMEOUT_MS = 30_000;

/** Creates are billable and not idempotent, so they are never retried. */
const CREATE_MAX_RETRIES = 0;
/** Reads are safe to repeat. */
const READ_MAX_RETRIES = 2;
/** Cancel/delete changes upstream state, so it is never retried. */
const MUTATION_MAX_RETRIES = 0;

const RETRY_BASE_DELAY_MS = 200;
const RETRY_MAX_DELAY_MS = 2_000;

/** Upstream error messages carry the internal code in parentheses, e.g. `... (1026)`. */
const TRAILING_CODE_PATTERN = /\((\d+)\)\s*$/;

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status < 600);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveRetryDelayMs(attempt: number, retryAfterSeconds: number | undefined): number {
  if (typeof retryAfterSeconds === 'number') {
    return Math.min(Math.max(retryAfterSeconds, 0) * 1000, RETRY_MAX_DELAY_MS);
  }

  return Math.min(RETRY_BASE_DELAY_MS * Math.pow(2, attempt), RETRY_MAX_DELAY_MS);
}

/**
 * Parses the OpenAI-style error envelope used by the MiniMax video V2 API:
 * `{ type: 'error', error: { type, message, http_code }, request_id }`.
 */
function parseVideoApiError(response: Response, body: unknown): MiniMaxApiError {
  const raw = body as Record<string, unknown> | undefined;
  const errorNode = raw?.error as Record<string, unknown> | undefined;

  if (errorNode && typeof errorNode.message === 'string') {
    const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get('retry-after'));
    const httpCode = typeof errorNode.http_code === 'string' ? Number(errorNode.http_code) : Number.NaN;
    const trailingCode = TRAILING_CODE_PATTERN.exec(errorNode.message);

    const code = trailingCode
      ? Number(trailingCode[1])
      : Number.isFinite(httpCode)
        ? httpCode
        : response.status;

    return {
      code,
      message: errorNode.message,
      status: response.status,
      retryAfterSeconds,
    };
  }

  return parseMiniMaxError(response, body);
}

interface FetchJsonOptions {
  method: string;
  body?: unknown;
  timeoutMs: number;
  maxRetries: number;
  operation: string;
}

async function fetchJson<T>(url: string, options: FetchJsonOptions, apiKey: string): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= options.maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const response = await fetch(url, {
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: buildAuthHeader(apiKey),
        },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await readResponseBodyOnce(response);
        const apiError = parseVideoApiError(response, body);

        if (isRetryableStatus(response.status) && attempt < options.maxRetries) {
          lastError = new MiniMaxVideoError(
            apiError.message,
            apiError.code,
            apiError.status,
            apiError.retryAfterSeconds,
          );
          emitUpstreamRetryTelemetry(apiError, options.operation, attempt + 1);
          await sleep(resolveRetryDelayMs(attempt, apiError.retryAfterSeconds));
          continue;
        }

        throw new MiniMaxVideoError(
          apiError.message,
          apiError.code,
          apiError.status,
          apiError.retryAfterSeconds,
        );
      }

      const data = await response.json() as T & {
        base_resp?: { status_code: number; status_msg?: string };
      };

      if (data?.base_resp && typeof data.base_resp.status_code === 'number' && data.base_resp.status_code !== 0) {
        const apiError = parseMiniMaxApplicationError(response.status, data.base_resp);
        throw new MiniMaxVideoError(apiError.message, apiError.code, apiError.status);
      }

      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new MiniMaxVideoError('Request timed out', 0, 408);

        if (attempt >= options.maxRetries) {
          throw timeoutError;
        }

        lastError = timeoutError;
        emitUpstreamRetryTelemetry(
          {
            code: timeoutError.code,
            message: timeoutError.message,
            status: timeoutError.status,
            retryAfterSeconds: timeoutError.retryAfterSeconds,
          },
          options.operation,
          attempt + 1,
        );
        await sleep(resolveRetryDelayMs(attempt, undefined));
        continue;
      }

      if (
        error instanceof MiniMaxVideoError
        && isRetryableStatus(error.status ?? 0)
        && attempt < options.maxRetries
      ) {
        lastError = error;
        emitUpstreamRetryTelemetry(
          {
            code: error.code,
            message: error.message,
            status: error.status,
            retryAfterSeconds: error.retryAfterSeconds,
          },
          options.operation,
          attempt + 1,
        );
        await sleep(resolveRetryDelayMs(attempt, error.retryAfterSeconds));
        continue;
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError;
}

/**
 * Maps the normalized content array onto the upstream wire format.
 */
function mapContentItems(content: readonly VideoContentInput[]): unknown[] {
  return content.map((item) => {
    if (item.type === 'text') {
      return { type: 'text', text: item.text };
    }

    if (item.type === 'image_url') {
      return {
        type: 'image_url',
        image_url: { url: item.url },
        ...(item.role ? { role: item.role } : {}),
      };
    }

    if (item.type === 'video_url') {
      return {
        type: 'video_url',
        video_url: { url: item.url },
        ...(item.role ? { role: item.role } : {}),
      };
    }

    return {
      type: 'audio_url',
      audio_url: { url: item.url },
      ...(item.role ? { role: item.role } : {}),
    };
  });
}

function assertValidTaskId(taskId: string): string {
  const parsed = VideoTaskIdSchema.safeParse(taskId);
  if (!parsed.success) {
    throw new MiniMaxVideoError('Invalid MiniMax task ID', 400, 400);
  }

  return parsed.data;
}

function readTaskId(payload: unknown): string {
  const raw = payload as Record<string, unknown> | undefined;
  const taskId = typeof raw?.task_id === 'string' ? raw.task_id.trim() : '';

  if (!taskId) {
    throw new MiniMaxVideoError('MiniMax did not return a task ID', 0, 502);
  }

  return taskId;
}

export class VideoClient implements IVideoClient {
  private readonly apiKey: string;

  constructor() {
    this.apiKey = requireMiniMaxApiKey();
  }

  async createGenerationTask(
    request: CreateVideoGenerationRequest,
  ): Promise<VideoCreateTaskResponse> {
    const body: Record<string, unknown> = {
      model: request.model,
      content: mapContentItems(request.content),
      resolution: request.resolution,
      duration: request.duration,
      ratio: request.ratio,
    };

    if (request.promptExpansionMode) {
      body.extra = { prompt_expansion_mode: request.promptExpansionMode };
    }

    const payload = await fetchJson<{ task_id?: string }>(
      `${MINIMAX_BASE_URL}/v2/video_generation`,
      {
        method: 'POST',
        body,
        timeoutMs: CREATE_TIMEOUT_MS,
        maxRetries: CREATE_MAX_RETRIES,
        operation: 'video.generation.create',
      },
      this.apiKey,
    );

    return { taskId: readTaskId(payload) };
  }

  async createContextIRTask(
    request: CreateVideoContextIRRequest,
  ): Promise<VideoCreateTaskResponse> {
    const payload = await fetchJson<{ task_id?: string }>(
      `${MINIMAX_BASE_URL}/v2/h3_context_ir`,
      {
        method: 'POST',
        body: {
          model: request.model,
          content: mapContentItems(request.content),
          duration: request.duration,
          ratio: request.ratio,
        },
        timeoutMs: CREATE_TIMEOUT_MS,
        maxRetries: CREATE_MAX_RETRIES,
        operation: 'video.contextIr.create',
      },
      this.apiKey,
    );

    return { taskId: readTaskId(payload) };
  }

  async createRegenerationTask(
    request: CreateVideoRegenerationRequest,
  ): Promise<VideoCreateTaskResponse> {
    const body: Record<string, unknown> = {
      model: request.model,
      resolution: request.resolution,
    };

    if (request.sourceTaskId) {
      body.source_task_id = request.sourceTaskId;
    } else {
      body.content = mapContentItems(request.content ?? []);
    }

    if (request.aigcWatermark !== undefined) {
      body.aigc_watermark = request.aigcWatermark;
    }

    const payload = await fetchJson<{ task_id?: string }>(
      `${MINIMAX_BASE_URL}/v2/video_regeneration`,
      {
        method: 'POST',
        body,
        timeoutMs: CREATE_TIMEOUT_MS,
        maxRetries: CREATE_MAX_RETRIES,
        operation: 'video.regeneration.create',
      },
      this.apiKey,
    );

    return { taskId: readTaskId(payload) };
  }

  async queryTask(taskId: string): Promise<VideoTaskResponse> {
    const safeTaskId = assertValidTaskId(taskId);

    const payload = await fetchJson<{ task?: unknown }>(
      `${MINIMAX_BASE_URL}/v2/query/video_generation/${encodeURIComponent(safeTaskId)}`,
      {
        method: 'GET',
        timeoutMs: READ_TIMEOUT_MS,
        maxRetries: READ_MAX_RETRIES,
        operation: 'video.task.query',
      },
      this.apiKey,
    );

    return { task: normalizeVideoTask(payload.task) };
  }

  async listTasks(params: VideoListTasksParams): Promise<VideoListTasksResponse> {
    const search = new URLSearchParams();
    search.set('page_num', String(params.pageNum));
    search.set('page_size', String(params.pageSize));

    if (params.status) search.set('filter.status', params.status);
    if (params.taskType) search.set('filter.task_type', params.taskType);
    if (params.model) search.set('filter.model', params.model);
    for (const taskId of params.taskIds ?? []) {
      search.append('filter.task_ids', taskId);
    }

    const payload = await fetchJson<{ items?: unknown[]; total?: number }>(
      `${MINIMAX_BASE_URL}/v2/query/video_generation?${search.toString()}`,
      {
        method: 'GET',
        timeoutMs: READ_TIMEOUT_MS,
        maxRetries: READ_MAX_RETRIES,
        operation: 'video.task.list',
      },
      this.apiKey,
    );

    const list = normalizeVideoTaskList(payload);
    return { items: list.items, total: list.total };
  }

  async cancelOrDeleteTask(taskId: string): Promise<VideoTaskActionResponse> {
    const safeTaskId = assertValidTaskId(taskId);

    const payload = await fetchJson<{
      task_id?: string;
      action?: string;
      status?: string;
    }>(
      `${MINIMAX_BASE_URL}/v2/video_generation/${encodeURIComponent(safeTaskId)}`,
      {
        method: 'DELETE',
        timeoutMs: READ_TIMEOUT_MS,
        maxRetries: MUTATION_MAX_RETRIES,
        operation: 'video.task.cancel',
      },
      this.apiKey,
    );

    const action = payload.action === 'deleted' ? 'deleted' : 'cancelled';

    return {
      taskId: typeof payload.task_id === 'string' && payload.task_id.trim().length > 0
        ? payload.task_id.trim()
        : safeTaskId,
      action,
      status: action,
    };
  }
}
