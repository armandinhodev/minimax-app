/**
 * MiniMax Speech HTTP client — all T2A and voice operations.
 * Server-only: never imported from client-side code.
 * @server-only
 */

import 'server-only';

import type { AudioOutput } from '@/domain/entities/AudioOutput';
import type { T2ATask } from '@/domain/entities/T2ATask';
import type { TaskStatus } from '@/domain/value-objects/TaskStatus';
import type { Voice } from '@/domain/entities/Voice';
import type { VoiceId } from '@/domain/value-objects/VoiceId';
import { DEFAULT_T2A_FORMAT, DEFAULT_T2A_MODEL, type T2ARequest } from '@/domain/value-objects/T2APolicy';
import {
  isMiniMaxInt64,
  normalizeMiniMaxId,
  quoteMiniMaxInt64Fields,
  rawMiniMaxInt64,
  stringifyMiniMaxJson,
} from '@/application/dto/FileDTO';
import {
  VOICE_CLONE_NOT_VERIFIED_CODE,
  VoiceCloneNotVerifiedError,
} from '@/application/errors/VoiceCloneNotVerifiedError';

import {
  buildAuthHeader,
  MINIMAX_BASE_URL,
  parseMiniMaxApplicationError,
  parseMiniMaxError,
  requireMiniMaxApiKey,
  type MiniMaxApiError,
} from './MiniMaxConfig';
import { captureServerError } from '@/lib/telemetry';
import { emitUpstreamRetryTelemetry, readResponseBodyOnce } from './retry-utils';

const GROUP_ID = process.env.MINIMAX_GROUP_ID ?? '';

/** Normalized application error for MiniMax API failures */
export class MiniMaxSpeechError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly status?: number,
    public readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'MiniMaxSpeechError';
  }
}

/**
 * Maps a MiniMaxApiError to an application error.
 * Error code 2038 → VoiceCloneNotVerifiedError.
 * Also handles HTTP 200 responses with non-zero base_resp.status_code.
 */
function normalizeError(apiError: MiniMaxApiError): Error {
  if (apiError.code === VOICE_CLONE_NOT_VERIFIED_CODE) {
    return new VoiceCloneNotVerifiedError();
  }
  return new MiniMaxSpeechError(apiError.message, apiError.code, apiError.status, apiError.retryAfterSeconds);
}

/** Shortcut for building MiniMax API fetch options with auth */
function buildRequestInit(apiKey: string, body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: {
      Authorization: buildAuthHeader(apiKey),
      'Content-Type': 'application/json',
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

/** Appends group_id to the URL search params */
function withGroupId(url: string, groupId: string): string {
  const base = `${MINIMAX_BASE_URL}${url}`;
  if (!groupId) return base;
  return `${base}?group_id=${encodeURIComponent(groupId)}`;
}

/** Retryable status codes: 408 (timeout), 429 (rate limit), 5xx (server error) */
function isRetryable(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status < 600);
}

/** Returns true if the error is a retryable MiniMax failure */
function isRetryableError(error: unknown): boolean {
  if (error instanceof MiniMaxSpeechError) {
    return isRetryable(error.status ?? 0);
  }
  return false;
}

/** Default fetch timeout in milliseconds */
const FETCH_TIMEOUT_MS = 30_000;
const STREAM_READ_TIMEOUT_MS = 15_000;

/** Default retry configuration */
const DEFAULT_RETRY_OPTS = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 8_000,
};

/** Sleep utility */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveRetryDelayMs(
  attempt: number,
  retryAfterSeconds: number | undefined,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  if (typeof retryAfterSeconds === 'number') {
    return Math.min(Math.max(retryAfterSeconds, 0) * 1000, maxDelayMs);
  }

  return Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
}

function isJsonResponse(response: Response): boolean {
  const contentType = response.headers.get('content-type') ?? response.headers.get('Content-Type') ?? '';
  return /(^|\s|;|,)(application\/json|[^\s;,]+\+json)(\s|;|,|$)/i.test(contentType);
}

async function parseApplicationErrorResponse(response: Response): Promise<MiniMaxApiError | undefined> {
  if (!isJsonResponse(response)) {
    return undefined;
  }

  const body = await readResponseBodyOnce(response.clone());
  const raw = body as { base_resp?: { status_code?: number; status_msg?: string } } | undefined;

  if (typeof raw?.base_resp?.status_code !== 'number' || raw.base_resp.status_code === 0) {
    return undefined;
  }

  return parseMiniMaxApplicationError(response.status, {
    status_code: raw.base_resp.status_code,
    status_msg: raw.base_resp.status_msg,
  });
}

function readChunkWithTimeout(reader: ReadableStreamDefaultReader<Uint8Array>) {
  return new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      void reader.cancel();
      reject(new MiniMaxSpeechError('Streaming stalled while reading MiniMax response', 0, 504));
    }, STREAM_READ_TIMEOUT_MS);

    reader.read().then(
      (result) => {
        clearTimeout(timeoutId);
        resolve(result);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

/**
 * Parse a MiniMax JSON body.
 *
 * `file_id` and `task_id` are int64 values, so the raw digits are quoted
 * before parsing to keep them exact instead of losing precision in an
 * IEEE-754 double.
 */
function parseMiniMaxJson<T>(text: string): T & { base_resp?: { status_code: number; status_msg: string } } {
  return JSON.parse(quoteMiniMaxInt64Fields(text)) as T & { base_resp?: { status_code: number; status_msg: string } };
}

/**
 * Normalize a MiniMax file identifier.
 * MiniMax identifiers are int64, so the exact decimal digits are kept.
 */
function parseMiniMaxFileId(fileId: string, fieldName: string): string {
  const trimmed = fileId.trim();

  if (!isMiniMaxInt64(trimmed) || Number(trimmed) <= 0) {
    throw new MiniMaxSpeechError(`${fieldName} must be a positive numeric MiniMax file ID`, 0, 400);
  }

  return trimmed;
}

/**
 * Normalize a MiniMax task status.
 * The documented enum is lowercase (`success`, `failed`, `expired`,
 * `processing`) while some responses use the capitalized form.
 */
function normalizeTaskStatus(status: unknown): TaskStatus {
  const normalized = typeof status === 'string' ? status.trim().toLowerCase() : '';
  switch (normalized) {
    case 'success':
    case 'failed':
    case 'expired':
    case 'processing':
      return normalized;
    default:
      return 'processing';
  }
}

/**
 * Normalize the voice-design trial audio to hex.
 *
 * The MiniMax API reference documents `trial_audio` as hex-encoded audio, so
 * the payload is used as-is. A non-hex payload is still decoded as base64 so a
 * legacy response keeps working.
 */
function toTrialAudioHex(trialAudio?: string): string | undefined {
  const trimmed = trialAudio?.trim();
  if (!trimmed) return undefined;

  if (trimmed.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  try {
    const binaryStr = atob(trimmed);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // If base64 decode fails, leave trialAudioHex undefined
    return undefined;
  }
}

/**
 * Fetch with timeout and retry for retryable errors.
 * Preserves 429 status in normalized errors where possible.
 */
async function fetchWithRetry<T>(
  url: string,
  init: RequestInit,
  apiKey: string,
  operation: string,
  options: { maxRetries?: number; baseDelayMs?: number; maxDelayMs?: number } = {}
): Promise<T> {
  const { maxRetries = DEFAULT_RETRY_OPTS.maxRetries, baseDelayMs = DEFAULT_RETRY_OPTS.baseDelayMs, maxDelayMs = DEFAULT_RETRY_OPTS.maxDelayMs } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          ...init.headers,
          Authorization: buildAuthHeader(apiKey),
        },
      });

      if (!response.ok) {
        const body = await readResponseBodyOnce(response);
        const error = parseMiniMaxError(response, body);

        if (isRetryable(response.status) && attempt < maxRetries) {
          lastError = normalizeError(error);
          emitUpstreamRetryTelemetry(error, operation, attempt + 1);
          const delay = resolveRetryDelayMs(attempt, error.retryAfterSeconds, baseDelayMs, maxDelayMs);
          await sleep(delay);
          continue;
        }

        throw normalizeError(error);
      }

      const data = parseMiniMaxJson<T>(await response.text());

      if (data?.base_resp && typeof data.base_resp.status_code === 'number' && data.base_resp.status_code !== 0) {
        const apiError = parseMiniMaxApplicationError(response.status, data.base_resp);
        const normalizedError = normalizeError(apiError);

        if (isRetryableError(normalizedError) && attempt < maxRetries) {
          lastError = normalizedError;
          emitUpstreamRetryTelemetry(apiError, operation, attempt + 1);
          const delay = resolveRetryDelayMs(attempt, apiError.retryAfterSeconds, baseDelayMs, maxDelayMs);
          await sleep(delay);
          continue;
        }

        throw normalizedError;
      }

      return data;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        err = new MiniMaxSpeechError('Request timed out', 0, 408);
      }
      if (!isRetryableError(err) || attempt >= maxRetries) {
        throw err;
      }
      lastError = err;
      emitUpstreamRetryTelemetry(
        {
          code: err instanceof MiniMaxSpeechError ? err.code : 0,
          message: err instanceof Error ? err.message : 'MiniMax retryable failure',
          status: err instanceof MiniMaxSpeechError ? err.status : undefined,
          retryAfterSeconds: err instanceof MiniMaxSpeechError ? err.retryAfterSeconds : undefined,
        },
        operation,
        attempt + 1
      );
      const delay = resolveRetryDelayMs(
        attempt,
        err instanceof MiniMaxSpeechError ? err.retryAfterSeconds : undefined,
        baseDelayMs,
        maxDelayMs
      );
      await sleep(delay);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError;
}

async function fetchResponseWithRetry(
  url: string,
  init: RequestInit,
  apiKey: string,
  operation: string,
  options: { maxRetries?: number; baseDelayMs?: number; maxDelayMs?: number } = {}
): Promise<Response> {
  const { maxRetries = DEFAULT_RETRY_OPTS.maxRetries, baseDelayMs = DEFAULT_RETRY_OPTS.baseDelayMs, maxDelayMs = DEFAULT_RETRY_OPTS.maxDelayMs } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          ...init.headers,
          Authorization: buildAuthHeader(apiKey),
        },
      });

      if (!response.ok) {
        const body = await readResponseBodyOnce(response);
        const error = parseMiniMaxError(response, body);

        if (isRetryable(response.status) && attempt < maxRetries) {
          lastError = normalizeError(error);
          emitUpstreamRetryTelemetry(error, operation, attempt + 1);
          await sleep(resolveRetryDelayMs(attempt, error.retryAfterSeconds, baseDelayMs, maxDelayMs));
          continue;
        }

        throw normalizeError(error);
      }

      const applicationError = await parseApplicationErrorResponse(response);
      if (applicationError) {
        const normalizedError = normalizeError(applicationError);

        if (isRetryableError(normalizedError) && attempt < maxRetries) {
          lastError = normalizedError;
          emitUpstreamRetryTelemetry(applicationError, operation, attempt + 1);
          await sleep(resolveRetryDelayMs(attempt, applicationError.retryAfterSeconds, baseDelayMs, maxDelayMs));
          continue;
        }

        throw normalizedError;
      }

      return response;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        err = new MiniMaxSpeechError('Request timed out', 0, 408);
      }

      if (!isRetryableError(err) || attempt >= maxRetries) {
        throw err;
      }

      lastError = err;
      emitUpstreamRetryTelemetry(
        {
          code: err instanceof MiniMaxSpeechError ? err.code : 0,
          message: err instanceof Error ? err.message : 'MiniMax retryable failure',
          status: err instanceof MiniMaxSpeechError ? err.status : undefined,
          retryAfterSeconds: err instanceof MiniMaxSpeechError ? err.retryAfterSeconds : undefined,
        },
        operation,
        attempt + 1
      );
      await sleep(resolveRetryDelayMs(
        attempt,
        err instanceof MiniMaxSpeechError ? err.retryAfterSeconds : undefined,
        baseDelayMs,
        maxDelayMs
      ));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// IMiniMaxSpeechClient implementation
// ---------------------------------------------------------------------------

export class MiniMaxSpeechClient {
  private readonly apiKey: string;

  constructor() {
    this.apiKey = requireMiniMaxApiKey();
  }

  /**
   * Sync T2A — text ≤ 10 000 chars → audio hex or download URL.
   * POST /v1/t2a_v2
   */
  async synthesize(request: T2ARequest): Promise<AudioOutput & { audioHex?: string }> {
    const { text, voiceId, model = DEFAULT_T2A_MODEL, format = DEFAULT_T2A_FORMAT } = request;
    const url = withGroupId('/v1/t2a_v2', GROUP_ID);
    const body = {
      model,
      text,
      voice_setting: {
        voice_id: voiceId,
      },
      audio_setting: {
        format,
      },
      // The app stores the synthesized audio locally, so it always asks for the
      // hex payload and never the expiring download URL.
      output_format: 'hex',
    };

    const data = await fetchWithRetry<MiniMaxT2AResponse>(url, buildRequestInit(this.apiKey, body), this.apiKey, 'speech.synthesize');

    // MiniMax returns the hex payload in data.audio and reports the duration in
    // extra_info.audio_length (milliseconds).
    const audioHex = data.data?.audio;
    const audioUrl = data.data?.audio_url;
    const audioLengthMs = data.extra_info?.audio_length;

    return {
      id: crypto.randomUUID(),
      format,
      duration: typeof audioLengthMs === 'number' ? audioLengthMs / 1000 : data.data?.duration,
      downloadUrl: audioUrl ?? '',
      expiresAt: audioUrl ? Date.now() + 9 * 60 * 60 * 1000 : undefined,
      audioHex: audioHex ?? undefined,
    } as unknown as AudioOutput & { audioHex?: string };
  }

  /**
   * SSE streaming T2A — returns a ReadableStream of raw SSE chunks.
   * POST /v1/t2a_v2 with stream: true
   */
  async stream(text: string, voiceId: string, model = DEFAULT_T2A_MODEL): Promise<ReadableStream> {
    const url = withGroupId('/v1/t2a_v2', GROUP_ID);
    const body = {
      model,
      text,
      voice_setting: {
        voice_id: voiceId,
      },
      stream: true,
    };

    const response = await fetchResponseWithRetry(
      url,
      {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      },
      this.apiKey,
      'speech.stream'
    );

    if (!response.body) {
      throw new MiniMaxSpeechError('Streaming response has no body', 0, response.status);
    }

    // MiniMax SSE stream: each event contains a base64 audio chunk
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

    return new ReadableStream({
      async start(controller) {
        reader = response.body!.getReader();

        try {
          while (true) {
            const { done, value } = await readChunkWithTimeout(reader);
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            // Forward raw SSE chunk bytes directly to the client
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (error) {
          if (error instanceof MiniMaxSpeechError && error.status === 504) {
            captureServerError(error, {
              endpoint: '/api/minimax/tts/stream',
              method: 'GET',
              statusCode: 504,
              kind: 'stream_stall',
              operation: 'minimax-stream-read',
            });
          } else {
            captureServerError(error, {
              endpoint: '/api/minimax/tts/stream',
              method: 'GET',
              statusCode: 502,
              kind: 'stream_failure',
              operation: 'minimax-stream-read',
            });
          }

          controller.error(error);
        } finally {
          try {
            controller.close();
          } catch {
            // Ignore double-close after controller.error().
          }
        }
      },
      cancel() {
        return reader?.cancel();
      },
    });
  }

  /**
   * Async T2A submission — returns task_id for long texts.
   * POST /v1/t2a_async_v2
   */
  async submitAsync(request: T2ARequest): Promise<T2ATask> {
    const { text, voiceId, model = DEFAULT_T2A_MODEL, format = DEFAULT_T2A_FORMAT } = request;
    const url = withGroupId('/v1/t2a_async_v2', GROUP_ID);
    const body = {
      model,
      text,
      voice_setting: {
        voice_id: voiceId,
      },
      audio_setting: {
        format,
      },
    };

    const data = await fetchWithRetry<MiniMaxAsyncT2AResponse>(
      url,
      buildRequestInit(this.apiKey, body),
      this.apiKey,
      'speech.submitAsync'
    );

    // The documented response carries task_id at the top level.
    const taskId = normalizeMiniMaxId(data.task_id) ?? normalizeMiniMaxId(data.data?.task_id);
    if (!taskId) throw new MiniMaxSpeechError('MiniMax returned an empty task ID', 0, 502);

    return {
      taskId,
      status: 'processing' as TaskStatus,
      createdAt: Date.now(),
    };
  }

  /**
   * Poll async T2A task status.
   * GET /v1/query/t2a_async_query_v2?task_id=<taskId>
   */
  async pollTask(taskId: string): Promise<{ status: TaskStatus; fileId?: string }> {
    const base = `${MINIMAX_BASE_URL}/v1/query/t2a_async_query_v2`;
    const params = new URLSearchParams({ task_id: taskId });
    if (GROUP_ID) params.set('group_id', GROUP_ID);
    const url = `${base}?${params}`;

    const data = await fetchWithRetry<MiniMaxPollT2AResponse>(
      url,
      { method: 'GET', headers: { Authorization: buildAuthHeader(this.apiKey) } },
      this.apiKey,
      'speech.pollTask'
    );

    // The documented response carries status and file_id at the top level.
    const rawStatus = data.status ?? data.data?.status ?? 'processing';
    const fileId = normalizeMiniMaxId(data.file_id) ?? normalizeMiniMaxId(data.data?.file_id) ?? undefined;

    return {
      status: normalizeTaskStatus(rawStatus),
      fileId,
    };
  }

  /**
   * List all voices (system + user-owned).
   * POST /v1/get_voice with { voice_type: 'all' }
   */
  async getVoices(): Promise<Voice[]> {
    const url = withGroupId('/v1/get_voice', GROUP_ID);

    const data = await fetchWithRetry<MiniMaxVoiceListResponse>(
      url,
      {
        method: 'POST',
        headers: { Authorization: buildAuthHeader(this.apiKey), 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice_type: 'all' }),
      },
      this.apiKey,
      'speech.getVoices'
    );

    // Track source array so we can map to correct Voice.type without inferring from voice_id prefix
    type VoiceEntry = {
      voice_id: string;
      name?: string;
      voice_name?: string;
      voice_id_str?: string;
      created_at?: number;
    };

    const allVoices: Array<VoiceEntry & { source: 'system' | 'clone' | 'design' }> = [];

    if (data.system_voice) {
      // The documented response is an array of SystemVoiceInfo; older payloads
      // keyed the system voices by language, so both shapes are accepted.
      const systemVoices = Array.isArray(data.system_voice)
        ? data.system_voice
        : Object.values(data.system_voice);
      for (const val of systemVoices) {
        if (val && typeof val === 'object' && 'voice_id' in val) {
          allVoices.push({ ...(val as VoiceEntry), source: 'system' });
        }
      }
    }
    if (data.voice_cloning) {
      for (const val of data.voice_cloning) {
        allVoices.push({ ...val, source: 'clone' });
      }
    }
    if (data.voice_generation) {
      for (const val of data.voice_generation) {
        allVoices.push({ ...val, source: 'design' });
      }
    }

    return allVoices.map((v) => ({
      voiceId: v.voice_id ?? v.voice_id_str ?? '',
      // The documented display name is `voice_name`; `name` is the legacy field.
      name: v.voice_name ?? v.name ?? v.voice_id ?? '',
      // Language is only meaningful for system voices (MiniMax prefixes them
      // with a language code like "English_", "Korean_", etc.). User voices
      // (clone / design) get auto-generated IDs from MiniMax that may
      // happen to contain underscores — extracting a "language" from those
      // would misclassify them in the UI (e.g., "voice_abc123" → "voice"
      // group). Forcing language=undefined for user voices routes them
      // to the "My Voices" group in the dropdown.
      language:
        v.source === 'system' && v.voice_id?.includes('_')
          ? v.voice_id.split('_')[0]
          : undefined,
      type: v.source,
      ttlExpiry: undefined,
      createdAt: v.created_at ?? Date.now(),
    }));
  }

  /**
   * Clone a voice.
   * POST /v1/voice_clone
   * Error 2038 → VoiceCloneNotVerifiedError
   */
  async cloneVoice(
    audioFileId: string,
    voiceId: string,
    options?: {
      optionalClonePrompt?: { promptAudio: string; promptText?: string };
      optionalPreviewText?: string;
      optionalModel?: string;
    }
  ): Promise<Voice> {
    const url = withGroupId('/v1/voice_clone', GROUP_ID);
    const fileId = parseMiniMaxFileId(audioFileId, 'file_id');
    const promptAudio = options?.optionalClonePrompt
      ? parseMiniMaxFileId(options.optionalClonePrompt.promptAudio, 'clone_prompt.prompt_audio')
      : null;

    // `file_id` and `clone_prompt.prompt_audio` are int64 values, so they are
    // serialized as exact numeric literals instead of lossy doubles.
    const body = stringifyMiniMaxJson({
      file_id: rawMiniMaxInt64(fileId),
      voice_id: voiceId,
      ...(promptAudio
        ? {
          clone_prompt: {
            prompt_audio: rawMiniMaxInt64(promptAudio),
            prompt_text: options?.optionalClonePrompt?.promptText,
          },
        }
        : {}),
      ...(options?.optionalPreviewText ? { text: options.optionalPreviewText } : {}),
      ...(options?.optionalModel ? { model: options.optionalModel } : {}),
    });

    const data = await fetchWithRetry<MiniMaxVoiceCloneResponse>(
      url,
      buildRequestInit(this.apiKey, body),
      this.apiKey,
      'speech.cloneVoice'
    );

    return {
      // The documented response does not echo the voice_id, so the requested one
      // is authoritative.
      voiceId: data.data?.voice_id ?? voiceId,
      name: data.data?.name ?? voiceId,
      type: 'clone',
      createdAt: Date.now(),
    };
  }

  /**
   * Design a voice (prompt → voice).
   * POST /v1/voice_design
   * Response: { voice_id, trial_audio (hex), base_resp }
   */
  async designVoice(prompt: string, previewText: string): Promise<Voice & { trialAudioHex?: string }> {
    const url = withGroupId('/v1/voice_design', GROUP_ID);
    const body = { prompt, preview_text: previewText };

    const data = await fetchWithRetry<MiniMaxVoiceDesignResponse>(
      url,
      buildRequestInit(this.apiKey, body),
      this.apiKey,
      'speech.designVoice'
    );

    const voiceId = data.voice_id?.trim();
    if (!voiceId) throw new MiniMaxSpeechError('MiniMax returned an empty designed voice ID', 0, 502);

    const trialAudioHex = toTrialAudioHex(data.trial_audio);

    return {
      voiceId,
      name: prompt.slice(0, 64),
      type: 'design',
      ttlExpiry: Date.now() + 168 * 60 * 60 * 1000, // 168-hour TTL
      createdAt: Date.now(),
      trialAudioHex,
    };
  }

  /**
   * Delete a user voice.
   * POST /v1/delete_voice
   */
  async deleteVoice(voiceId: VoiceId, voiceType: 'voice_cloning' | 'voice_generation' = 'voice_cloning'): Promise<void> {
    const url = withGroupId('/v1/delete_voice', GROUP_ID);
    const body = { voice_type: voiceType, voice_id: voiceId };

    await fetchWithRetry<Record<string, unknown>>(
      url,
      buildRequestInit(this.apiKey, body),
      this.apiKey,
      'speech.deleteVoice'
    );
  }
}

// ---------------------------------------------------------------------------
// MiniMax API response shapes (approximate)
// ---------------------------------------------------------------------------

interface MiniMaxT2AResponse {
  code: number;
  msg: string;
  data?: {
    audio?: string;      // hex-encoded audio
    audio_url?: string;  // download URL
    duration?: number;
  };
  extra_info?: {
    audio_length?: number; // milliseconds
    audio_sample_rate?: number;
    audio_size?: number;
    bitrate?: number;
    audio_format?: string;
    audio_channel?: number;
    usage_characters?: number;
  };
}

interface MiniMaxAsyncT2AResponse {
  code: number;
  msg: string;
  task_id?: string | number;
  file_id?: string | number;
  data?: {
    task_id?: string | number;
  };
}

interface MiniMaxPollT2AResponse {
  code: number;
  msg: string;
  task_id?: string | number;
  status?: string;
  file_id?: string | number;
  data?: {
    status: string;
    file_id?: string | number;
  };
}

interface MiniMaxVoiceListResponse {
  base_resp?: { status_code: number; status_msg: string };
  system_voice?: Record<string, { voice_id: string; name?: string; voice_name?: string; voice_id_str?: string; created_at?: number }>
    | Array<{ voice_id: string; name?: string; voice_name?: string; voice_id_str?: string; created_at?: number }>;
  voice_cloning?: Array<{ voice_id: string; name?: string; voice_name?: string; voice_id_str?: string; created_at?: number }>;
  voice_generation?: Array<{ voice_id: string; name?: string; voice_name?: string; voice_id_str?: string; created_at?: number }>;
}

interface MiniMaxVoiceCloneResponse {
  base_resp?: { status_code: number; status_msg: string };
  demo_audio?: string;
  data?: {
    voice_id?: string;
    name?: string;
  };
}

interface MiniMaxVoiceDesignResponse {
  base_resp?: { status_code: number; status_msg: string };
  voice_id?: string;
  trial_audio?: string; // hex-encoded preview audio
}
