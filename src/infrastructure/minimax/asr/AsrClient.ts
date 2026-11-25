/**
 * MiniMax Speech-to-Text (ASR) client.
 * @server-only — this module must never be bundled for the browser.
 *
 * https://platform.minimax.io/docs/api-reference/speech-to-text
 *
 * The endpoint takes multipart/form-data with the audio binary. Transcriptions
 * are billed by audio duration, so this client never retries: a retry after an
 * ambiguous failure could charge the same audio twice.
 */

import 'server-only';

import {
  ASR_SUBTITLE_FORMATS,
  type AsrSegmentDTO,
  type AsrStreamEventDTO,
  type AsrSubtitleDTO,
  type AsrSubtitleFormat,
  type AsrTranscriptDTO,
  type AsrTranscriptionOptions,
} from '@/application/dto/minimax/asr/AsrDTO';
import type { IAsrClient } from '@/domain/interfaces/minimax/asr/IAsrClient';

import { MINIMAX_BASE_URL, buildAuthHeader, requireMiniMaxApiKey } from '../MiniMaxConfig';
import { readResponseBodyOnce } from '../retry-utils';

const ASR_PATH = '/v1/speech_to_text';
const ASR_TIMEOUT_MS = 120_000;

/** Error raised by the ASR endpoint. */
export class MiniMaxAsrError extends Error {
  constructor(
    message: string,
    readonly code: number,
    readonly status: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'MiniMaxAsrError';
  }
}

/**
 * The ASR API answers with an OpenAI-style error envelope:
 * { type: 'error', error: { type, message, http_code }, request_id }.
 */
function parseAsrError(response: Response, body: unknown): MiniMaxAsrError {
  const raw = body as Record<string, unknown> | undefined;
  const detail = raw?.error as Record<string, unknown> | undefined;

  const message =
    typeof detail?.message === 'string' && detail.message.trim().length > 0
      ? detail.message
      : response.statusText || 'MiniMax ASR request failed';

  const httpCode = typeof detail?.http_code === 'string' ? Number(detail.http_code) : NaN;
  const code = Number.isFinite(httpCode) ? httpCode : response.status;

  return new MiniMaxAsrError(message, code, response.status);
}

/** Builds the multipart body documented for /v1/speech_to_text. */
function buildFormData(
  fileContent: Buffer,
  fileName: string,
  options: AsrTranscriptionOptions,
): FormData {
  const formData = new FormData();
  formData.append('model', options.model);
  formData.append('file', new Blob([new Uint8Array(fileContent)], { type: 'audio/mpeg' }), fileName);
  formData.append('response_format', options.responseFormat);
  formData.append('timestamp_level', options.timestampLevel);
  formData.append('stream', String(options.stream));

  return formData;
}

function buildHeaders(options: AsrTranscriptionOptions): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: buildAuthHeader(requireMiniMaxApiKey()),
  };

  // Omitting the header (or sending it empty) enables mixed-language recognition.
  if (options.language.trim().length > 0) {
    headers.language = options.language.trim();
  }

  return headers;
}

function isSubtitleFormat(format: string): format is AsrSubtitleFormat {
  return (ASR_SUBTITLE_FORMATS as readonly string[]).includes(format);
}

/**
 * Normalizes the JSON payload documented for `response_format=json` and
 * `response_format=verbose_json`.
 */
function normalizeTranscript(payload: unknown): AsrTranscriptDTO {
  const raw = payload as Record<string, unknown> | undefined;

  const transcript: AsrTranscriptDTO = {
    text: typeof raw?.text === 'string' ? raw.text : '',
    duration: typeof raw?.duration === 'number' ? raw.duration : 0,
  };

  if (typeof raw?.n_speakers === 'number') {
    transcript.nSpeakers = raw.n_speakers;
  }

  if (typeof raw?.trace_id === 'string') {
    transcript.traceId = raw.trace_id;
  }

  if (Array.isArray(raw?.segments)) {
    transcript.segments = raw.segments.flatMap((segment) => {
      const item = segment as Record<string, unknown> | undefined;
      if (!item || typeof item.id !== 'number' || typeof item.text !== 'string') return [];
      const normalized: AsrSegmentDTO = {
        id: item.id,
        start: typeof item.start === 'number' ? item.start : 0,
        end: typeof item.end === 'number' ? item.end : 0,
        text: item.text,
      };
      if (typeof item.speaker === 'string') normalized.speaker = item.speaker;
      return [normalized];
    });
  }

  return transcript;
}

/**
 * Parses one `data: {...}` line of the ASR event stream.
 * Returns null for blank lines, comments and malformed payloads.
 */
export function parseAsrStreamEvent(line: string): AsrStreamEventDTO | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return null;

  const payload = trimmed.slice('data:'.length).trim();
  if (payload.length === 0) return null;

  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    if (typeof parsed.index !== 'number' || typeof parsed.delta !== 'string') return null;

    const event: AsrStreamEventDTO = {
      index: parsed.index,
      delta: parsed.delta,
      finish: parsed.finish === true,
    };
    if (typeof parsed.duration === 'number') event.duration = parsed.duration;
    return event;
  } catch {
    return null;
  }
}

export class AsrClient implements IAsrClient {
  private readonly apiKey: string;

  constructor() {
    this.apiKey = requireMiniMaxApiKey();
  }

  async transcribe(
    fileContent: Buffer,
    fileName: string,
    options: AsrTranscriptionOptions,
  ): Promise<AsrTranscriptDTO | AsrSubtitleDTO> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ASR_TIMEOUT_MS);

    try {
      const response = await fetch(`${MINIMAX_BASE_URL}${ASR_PATH}`, {
        method: 'POST',
        headers: {
          ...buildHeaders(options),
          Authorization: buildAuthHeader(this.apiKey),
        },
        body: buildFormData(fileContent, fileName, options),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await readResponseBodyOnce(response);
        throw parseAsrError(response, body);
      }

      if (isSubtitleFormat(options.responseFormat)) {
        return {
          format: options.responseFormat,
          content: await response.text(),
        };
      }

      return normalizeTranscript(await response.json());
    } catch (error) {
      if (error instanceof MiniMaxAsrError) throw error;
      throw new MiniMaxAsrError(
        error instanceof Error ? error.message : 'MiniMax ASR request failed',
        0,
        502,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async transcribeStream(
    fileContent: Buffer,
    fileName: string,
    options: AsrTranscriptionOptions,
  ): Promise<ReadableStream<Uint8Array>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ASR_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${MINIMAX_BASE_URL}${ASR_PATH}`, {
        method: 'POST',
        headers: {
          ...buildHeaders(options),
          Authorization: buildAuthHeader(this.apiKey),
        },
        body: buildFormData(fileContent, fileName, options),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      throw new MiniMaxAsrError(
        error instanceof Error ? error.message : 'MiniMax ASR request failed',
        0,
        502,
      );
    }

    if (!response.ok) {
      clearTimeout(timeoutId);
      const body = await readResponseBodyOnce(response);
      throw parseAsrError(response, body);
    }

    if (!response.body) {
      clearTimeout(timeoutId);
      throw new MiniMaxAsrError('MiniMax ASR returned an empty stream', 0, 502);
    }

    // The upstream stream outlives this call: the timeout must not kill it.
    const body = response.body;
    return new ReadableStream<Uint8Array>({
      start(controller) {
        const reader = body.getReader();
        const pump = async () => {
          try {
            for (;;) {
              const { done, value } = await reader.read();
              if (done) {
                controller.close();
                return;
              }
              if (value) controller.enqueue(value);
            }
          } catch (error) {
            controller.error(error);
          }
        };
        void pump();
      },
      cancel() {
        clearTimeout(timeoutId);
      },
    });
  }
}
