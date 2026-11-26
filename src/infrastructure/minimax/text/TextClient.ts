/**
 * MiniMax Text (LLM) client.
 * @server-only — this module must never be bundled for the browser.
 *
 * One client covers the four upstream surfaces: the request body and the
 * response normalization depend on the surface, but the transport, the error
 * handling and the streaming plumbing are shared.
 */

import 'server-only';

import {
  fromAnthropicPayload,
  fromChatCompletionPayload,
  fromResponsesPayload,
  TEXT_SURFACE_PATHS,
  toAnthropicBody,
  toChatCompletionBody,
  toResponsesBody,
  type ChatCompletionOptions,
  type ChatCompletionResult,
  type InputTokensEstimate,
  type TextModelDTO,
  type TextSurface,
} from '@/application/dto/minimax/text/TextDTO';
import type { ITextClient } from '@/domain/interfaces/minimax/text/ITextClient';

import { MINIMAX_BASE_URL, buildAuthHeader, requireMiniMaxApiKey } from '../MiniMaxConfig';
import { readResponseBodyOnce } from '../retry-utils';

const COMPLETE_TIMEOUT_MS = 180_000;
const MODELS_TIMEOUT_MS = 30_000;

/** Error raised by the text endpoints. */
export class MiniMaxTextError extends Error {
  constructor(
    message: string,
    readonly code: number,
    readonly status: number,
  ) {
    super(message);
    this.name = 'MiniMaxTextError';
  }
}

/**
 * The text endpoints answer with two different error envelopes: the native
 * and OpenAI surfaces use `{ code, message }` plus a `base_resp`, while the
 * Anthropic and Responses surfaces use the OpenAI-style
 * `{ type: 'error', error: { type, message } }`.
 */
function parseTextError(response: Response, body: unknown): MiniMaxTextError {
  const raw = body as Record<string, unknown> | undefined;
  const detail = raw?.error as Record<string, unknown> | undefined;

  const message =
    (typeof detail?.message === 'string' && detail.message.trim().length > 0
      ? detail.message
      : undefined)
    ?? (typeof raw?.message === 'string' ? raw.message : undefined)
    ?? response.statusText
    ?? 'MiniMax text request failed';

  const httpCode = Number(detail?.http_code);
  const code = Number.isFinite(httpCode) && httpCode > 0
    ? httpCode
    : typeof raw?.code === 'number'
      ? raw.code
      : response.status;

  return new MiniMaxTextError(message, code, response.status);
}

/**
 * The native surface reports application errors inside a `base_resp` even on
 * HTTP 200, so the payload has to be inspected before trusting it.
 */
function parseApplicationError(payload: unknown): MiniMaxTextError | null {
  const raw = payload as Record<string, unknown> | undefined;
  const baseResp = raw?.base_resp as Record<string, unknown> | undefined;
  if (!baseResp) return null;

  const statusCode = typeof baseResp.status_code === 'number' ? baseResp.status_code : 0;
  if (statusCode === 0) return null;

  return new MiniMaxTextError(
    typeof baseResp.status_msg === 'string' && baseResp.status_msg.length > 0
      ? baseResp.status_msg
      : 'MiniMax text request failed',
    statusCode,
    statusCode >= 400 && statusCode < 600 ? statusCode : 502,
  );
}

function buildBody(
  request: ChatCompletionOptions,
  surface: TextSurface,
  options: { stream?: boolean; includeUsage?: boolean } = {},
): Record<string, unknown> {
  switch (surface) {
    case 'anthropic':
      return toAnthropicBody(request, options);
    case 'responses':
      return toResponsesBody(request, options);
    case 'native':
    case 'openai':
    default:
      return toChatCompletionBody(request, options);
  }
}

function normalizePayload(surface: TextSurface, payload: unknown): ChatCompletionResult {
  switch (surface) {
    case 'anthropic':
      return fromAnthropicPayload(payload);
    case 'responses':
      return fromResponsesPayload(payload);
    case 'native':
    case 'openai':
    default:
      return fromChatCompletionPayload(payload);
  }
}

export class TextClient implements ITextClient {
  private readonly apiKey: string;

  constructor() {
    this.apiKey = requireMiniMaxApiKey();
  }

  async complete(
    request: ChatCompletionOptions,
    surface: TextSurface,
  ): Promise<ChatCompletionResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), COMPLETE_TIMEOUT_MS);

    try {
      const response = await fetch(`${MINIMAX_BASE_URL}${TEXT_SURFACE_PATHS[surface]}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: buildAuthHeader(this.apiKey),
        },
        body: JSON.stringify(buildBody(request, surface)),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await readResponseBodyOnce(response);
        throw parseTextError(response, body);
      }

      const payload = await response.json();
      const applicationError = parseApplicationError(payload);
      if (applicationError) throw applicationError;

      return normalizePayload(surface, payload);
    } catch (error) {
      if (error instanceof MiniMaxTextError) throw error;
      throw new MiniMaxTextError(
        error instanceof Error ? error.message : 'MiniMax text request failed',
        0,
        502,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async completeStream(
    request: ChatCompletionOptions,
    surface: TextSurface,
  ): Promise<ReadableStream<Uint8Array>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), COMPLETE_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${MINIMAX_BASE_URL}${TEXT_SURFACE_PATHS[surface]}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: buildAuthHeader(this.apiKey),
        },
        body: JSON.stringify(buildBody(request, surface, { stream: true, includeUsage: true })),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      throw new MiniMaxTextError(
        error instanceof Error ? error.message : 'MiniMax text request failed',
        0,
        502,
      );
    }

    if (!response.ok) {
      clearTimeout(timeoutId);
      const body = await readResponseBodyOnce(response);
      throw parseTextError(response, body);
    }

    if (!response.body) {
      clearTimeout(timeoutId);
      throw new MiniMaxTextError('MiniMax returned an empty stream', 0, 502);
    }

    const body = response.body;
    return new ReadableStream<Uint8Array>({
      start(streamController) {
        const reader = body.getReader();
        const pump = async () => {
          try {
            for (;;) {
              const { done, value } = await reader.read();
              if (done) {
                streamController.close();
                return;
              }
              if (value) streamController.enqueue(value);
            }
          } catch (error) {
            streamController.error(error);
          }
        };
        void pump();
      },
      cancel() {
        clearTimeout(timeoutId);
      },
    });
  }

  async listModels(): Promise<TextModelDTO[]> {
    const response = await this.fetchJson(`${MINIMAX_BASE_URL}/v1/models`, 'GET');
    const payload = response as Record<string, unknown>;
    const data = Array.isArray(payload.data) ? payload.data : [];

    return data.flatMap((entry) => {
      const item = entry as Record<string, unknown>;
      const id = typeof item.id === 'string' ? item.id : undefined;
      if (!id) return [];
      const created = typeof item.created === 'number' ? item.created : undefined;
      const ownedBy = typeof item.owned_by === 'string' ? item.owned_by : undefined;
      return [{
        id,
        ...(created !== undefined ? { created } : {}),
        ...(ownedBy !== undefined ? { ownedBy } : {}),
      }];
    });
  }

  async getModel(modelId: string): Promise<TextModelDTO> {
    const response = await this.fetchJson(
      `${MINIMAX_BASE_URL}/v1/models/${encodeURIComponent(modelId)}`,
      'GET',
    );
    const payload = response as Record<string, unknown>;
    const id = typeof payload.id === 'string' ? payload.id : modelId;
    const created = typeof payload.created === 'number' ? payload.created : undefined;
    const ownedBy = typeof payload.owned_by === 'string' ? payload.owned_by : undefined;

    return {
      id,
      ...(created !== undefined ? { created } : {}),
      ...(ownedBy !== undefined ? { ownedBy } : {}),
    };
  }

  async estimateInputTokens(request: ChatCompletionOptions): Promise<InputTokensEstimate> {
    const payload = await this.fetchJson(
      `${MINIMAX_BASE_URL}/v1/responses/input_tokens`,
      'POST',
      toResponsesBody(request),
    );
    const raw = payload as Record<string, unknown>;
    return { inputTokens: typeof raw.input_tokens === 'number' ? raw.input_tokens : 0 };
  }

  private async fetchJson(
    url: string,
    method: 'GET' | 'POST',
    body?: Record<string, unknown>,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), MODELS_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: buildAuthHeader(this.apiKey),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await readResponseBodyOnce(response);
        throw parseTextError(response, errorBody);
      }

      const payload = await response.json();
      const applicationError = parseApplicationError(payload);
      if (applicationError) throw applicationError;
      return payload;
    } catch (error) {
      if (error instanceof MiniMaxTextError) throw error;
      throw new MiniMaxTextError(
        error instanceof Error ? error.message : 'MiniMax text request failed',
        0,
        502,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
