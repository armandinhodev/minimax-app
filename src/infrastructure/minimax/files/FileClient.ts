/**
 * MiniMax File API HTTP client.
 * Server-only: never imported from client-side code.
 * @server-only
 */

import 'server-only';

import type { FileMetadata } from '@/domain/interfaces/minimax/files/IFileClient';
import { FileDeletePurposeSchema, FileListPurposeSchema, FileUploadPurposeSchema, normalizeMiniMaxId, quoteMiniMaxInt64Fields, rawMiniMaxInt64, stringifyMiniMaxJson, type FileDeletePurpose, type FileListPurpose, type FileUploadPurpose } from '@/application/dto/minimax/files/FileDTO';

import { MINIMAX_BASE_URL, buildAuthHeader, parseMiniMaxApplicationError, parseMiniMaxError, requireMiniMaxApiKey, type MiniMaxApiError } from '../MiniMaxConfig';
import { emitUpstreamRetryTelemetry, readResponseBodyOnce } from '../retry-utils';

const GROUP_ID = process.env.MINIMAX_GROUP_ID ?? '';

export class MiniMaxFileError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly status?: number,
    public readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'MiniMaxFileError';
  }
}

function normalizeError(apiError: MiniMaxApiError): Error {
  return new MiniMaxFileError(apiError.message, apiError.code, apiError.status, apiError.retryAfterSeconds);
}

function withGroupId(url: string, groupId: string): string {
  const base = `${MINIMAX_BASE_URL}${url}`;
  if (!groupId) return base;
  return `${base}?group_id=${encodeURIComponent(groupId)}`;
}

function isRetryable(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status < 600);
}

function isRetryableFileError(error: unknown): boolean {
  if (error instanceof MiniMaxFileError) {
    return isRetryable(error.status ?? 0);
  }
  return false;
}

const FETCH_TIMEOUT_MS = 30_000;
const DEFAULT_RETRY_OPTS = { maxRetries: 3, baseDelayMs: 500, maxDelayMs: 8_000 };

/**
 * Reject a purpose that MiniMax does not document for the target endpoint.
 * Each File API endpoint accepts its own purpose subset.
 */
function assertPurpose<T extends string>(
  schema: { options: readonly T[] },
  purpose: string,
  endpoint: 'upload' | 'list' | 'delete'
): void {
  if (!(schema.options as readonly string[]).includes(purpose)) {
    throw new MiniMaxFileError(
      `purpose must be one of: ${schema.options.join(', ')} for the ${endpoint} endpoint`,
      0,
      400
    );
  }
}

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

/**
 * Parse a MiniMax File API JSON body.
 *
 * `file_id` is an int64, so the raw digits are quoted before parsing to keep
 * them exact instead of losing precision in an IEEE-754 double.
 */
function parseFileApiJson<T>(text: string): T & { base_resp?: { status_code: number; status_msg: string } } {
  return JSON.parse(quoteMiniMaxInt64Fields(text)) as T & { base_resp?: { status_code: number; status_msg: string } };
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
        headers: { ...init.headers, Authorization: buildAuthHeader(apiKey) },
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

      const data = parseFileApiJson<T>(await response.text());
      if (data?.base_resp && typeof data.base_resp.status_code === 'number' && data.base_resp.status_code !== 0) {
        const apiError = parseMiniMaxApplicationError(response.status, data.base_resp);
        const normalizedError = normalizeError(apiError);

        if (isRetryableFileError(normalizedError) && attempt < maxRetries) {
          lastError = normalizedError;
          emitUpstreamRetryTelemetry(apiError, operation, attempt + 1);
          await sleep(resolveRetryDelayMs(attempt, apiError.retryAfterSeconds, baseDelayMs, maxDelayMs));
          continue;
        }

        throw normalizedError;
      }
      return data;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') err = new MiniMaxFileError('Request timed out', 0, 408);
      if (!isRetryableFileError(err) || attempt >= maxRetries) throw err;
      lastError = err;
      emitUpstreamRetryTelemetry({
        code: err instanceof MiniMaxFileError ? err.code : 0,
        message: err instanceof Error ? err.message : 'MiniMax retryable failure',
        status: err instanceof MiniMaxFileError ? err.status : undefined,
        retryAfterSeconds: err instanceof MiniMaxFileError ? err.retryAfterSeconds : undefined,
      }, operation, attempt + 1);
      await sleep(resolveRetryDelayMs(attempt, err instanceof MiniMaxFileError ? err.retryAfterSeconds : undefined, baseDelayMs, maxDelayMs));
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
        headers: { ...init.headers, Authorization: buildAuthHeader(apiKey) },
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

        if (isRetryableFileError(normalizedError) && attempt < maxRetries) {
          lastError = normalizedError;
          emitUpstreamRetryTelemetry(applicationError, operation, attempt + 1);
          await sleep(resolveRetryDelayMs(attempt, applicationError.retryAfterSeconds, baseDelayMs, maxDelayMs));
          continue;
        }

        throw normalizedError;
      }

      return response;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') err = new MiniMaxFileError('Request timed out', 0, 408);
      if (!isRetryableFileError(err) || attempt >= maxRetries) throw err;
      lastError = err;
      emitUpstreamRetryTelemetry({
        code: err instanceof MiniMaxFileError ? err.code : 0,
        message: err instanceof Error ? err.message : 'MiniMax retryable failure',
        status: err instanceof MiniMaxFileError ? err.status : undefined,
        retryAfterSeconds: err instanceof MiniMaxFileError ? err.retryAfterSeconds : undefined,
      }, operation, attempt + 1);
      await sleep(resolveRetryDelayMs(attempt, err instanceof MiniMaxFileError ? err.retryAfterSeconds : undefined, baseDelayMs, maxDelayMs));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError;
}

/**
 * MiniMax File API client.
 * Handles upload, list, retrieve (metadata + URL), and delete.
 */
export class FileClient {  private readonly apiKey: string;

  constructor() {
    this.apiKey = requireMiniMaxApiKey();
  }

  /**
   * Upload a file.
   * POST /v1/files/upload
   */
  async uploadFile(
    fileContent: Buffer,
    fileName: string,
    purpose: FileUploadPurpose
  ): Promise<FileMetadata> {
    assertPurpose(FileUploadPurposeSchema, purpose, 'upload');
    const url = withGroupId('/v1/files/upload', GROUP_ID);

    const formData = new FormData();
    formData.append('file', new Blob([new Uint8Array(fileContent)]), fileName);
    formData.append('purpose', purpose);

    const data = await fetchWithRetry<MiniMaxFileUploadResponse>(
      url,
      {
        method: 'POST',
        headers: {
          Authorization: buildAuthHeader(this.apiKey),
        },
        body: formData,
      },
      this.apiKey,
      'file.upload',
      { maxRetries: 2, baseDelayMs: 500, maxDelayMs: 5_000 }
    );

    const fileId = normalizeMiniMaxId(data.file?.file_id);
    if (!fileId) throw new MiniMaxFileError('MiniMax returned an empty file ID', 0, 502);

    return {
      fileId,
      fileName: data.file?.filename ?? fileName,
      purpose,
      size: data.file?.bytes ?? fileContent.length,
      createdAt: data.file?.created_at ?? Date.now(),
    };
  }

  /**
   * List files, optionally filtered by purpose.
   * GET /v1/files/list?purpose=<purpose>
   */
  async listFiles(purpose?: FileListPurpose): Promise<FileMetadata[]> {
    if (purpose !== undefined) {
      assertPurpose(FileListPurposeSchema, purpose, 'list');
    }
    const params = new URLSearchParams();
    if (purpose) params.set('purpose', purpose);
    if (GROUP_ID) params.set('group_id', GROUP_ID);
    const url = `${MINIMAX_BASE_URL}/v1/files/list?${params}`;

    const data = await fetchWithRetry<MiniMaxFileListResponse>(
      url,
      { method: 'GET', headers: { Authorization: buildAuthHeader(this.apiKey) } },
      this.apiKey,
      'file.list'
    );

    return (data.files ?? []).map((f) => ({
      fileId: normalizeMiniMaxId(f.file_id) ?? '',
      fileName: f.filename ?? f.file_name ?? '',
      purpose: (f.purpose ?? '') as FileMetadata['purpose'],
      size: f.bytes ?? f.file_size ?? 0,
      createdAt: f.created_at ?? Date.now(),
    }));
  }

  /**
   * Retrieve file metadata and a fresh download URL.
   * GET /v1/files/retrieve?file_id=<fileId>
   */
  async getFile(fileId: string): Promise<FileMetadata & { downloadUrl: string }> {
    const url = `${MINIMAX_BASE_URL}/v1/files/retrieve?file_id=${encodeURIComponent(fileId)}&group_id=${encodeURIComponent(GROUP_ID)}`;

    let lastError: unknown;
    for (let attempt = 0; attempt <= DEFAULT_RETRY_OPTS.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers: { Authorization: buildAuthHeader(this.apiKey) },
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const body = await readResponseBodyOnce(response);
          const error = parseMiniMaxError(response, body);
          if (isRetryable(response.status) && attempt < DEFAULT_RETRY_OPTS.maxRetries) {
            lastError = normalizeError(error);
            emitUpstreamRetryTelemetry(error, 'file.get', attempt + 1);
            await sleep(Math.min(DEFAULT_RETRY_OPTS.baseDelayMs * Math.pow(2, attempt), DEFAULT_RETRY_OPTS.maxDelayMs));
            continue;
          }
          throw normalizeError(error);
        }

        const data = parseFileApiJson<MiniMaxFileRetrieveResponse>(await response.text());
        if (data?.base_resp && typeof data.base_resp.status_code === 'number' && data.base_resp.status_code !== 0) {
          const apiError = parseMiniMaxApplicationError(response.status, data.base_resp);
          const normalizedError = normalizeError(apiError);

          if (isRetryableFileError(normalizedError) && attempt < DEFAULT_RETRY_OPTS.maxRetries) {
            lastError = normalizedError;
            emitUpstreamRetryTelemetry(apiError, 'file.get', attempt + 1);
            await sleep(resolveRetryDelayMs(
              attempt,
              apiError.retryAfterSeconds,
              DEFAULT_RETRY_OPTS.baseDelayMs,
              DEFAULT_RETRY_OPTS.maxDelayMs
            ));
            continue;
          }

          throw normalizedError;
        }

        const downloadUrl = data.file?.download_url?.trim();
        if (!downloadUrl) throw new MiniMaxFileError('MiniMax returned an empty download URL', 0, 502);

        return {
          fileId: normalizeMiniMaxId(data.file?.file_id) ?? fileId,
          fileName: data.file?.filename ?? data.file?.file_name ?? '',
          purpose: (data.file?.purpose ?? '') as FileMetadata['purpose'],
          size: data.file?.bytes ?? data.file?.file_size ?? 0,
          createdAt: data.file?.created_at ?? Date.now(),
          downloadUrl,
        };
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') err = new MiniMaxFileError('Request timed out', 0, 408);
        if (!isRetryableFileError(err) || attempt >= DEFAULT_RETRY_OPTS.maxRetries) throw err;
        lastError = err;
        emitUpstreamRetryTelemetry({
          code: err instanceof MiniMaxFileError ? err.code : 0,
          message: err instanceof Error ? err.message : 'MiniMax retryable failure',
          status: err instanceof MiniMaxFileError ? err.status : undefined,
          retryAfterSeconds: err instanceof MiniMaxFileError ? err.retryAfterSeconds : undefined,
        }, 'file.get', attempt + 1);
        await sleep(Math.min(DEFAULT_RETRY_OPTS.baseDelayMs * Math.pow(2, attempt), DEFAULT_RETRY_OPTS.maxDelayMs));
      }
    }
    throw lastError;
  }

  /**
   * Delete a file.
   * POST /v1/files/delete with { file_id, purpose }
   */
  async deleteFile(fileId: string, purpose: FileDeletePurpose): Promise<void> {
    assertPurpose(FileDeletePurposeSchema, purpose, 'delete');
    const url = withGroupId('/v1/files/delete', GROUP_ID);
    const rawFileId = rawMiniMaxInt64(fileId);
    if (!rawFileId) {
      throw new MiniMaxFileError('file_id must be a positive numeric MiniMax file ID', 0, 400);
    }
    const body = stringifyMiniMaxJson({ file_id: rawFileId, purpose });

    await fetchWithRetry<Record<string, unknown>>(
      url,
      {
        method: 'POST',
        headers: {
          Authorization: buildAuthHeader(this.apiKey),
          'Content-Type': 'application/json',
        },
        body,
      },
      this.apiKey,
      'file.delete'
    );
  }

  /**
   * Retrieve file content as raw bytes.
   * GET /v1/files/retrieve_content?file_id=<fileId>
   */
  async retrieveContent(fileId: string): Promise<Uint8Array> {
    const params = new URLSearchParams({ file_id: fileId });
    if (GROUP_ID) params.set('group_id', GROUP_ID);
    const url = `${MINIMAX_BASE_URL}/v1/files/retrieve_content?${params}`;

    const response = await fetchResponseWithRetry(
      url,
      {
        method: 'GET',
      },
      this.apiKey,
      'file.retrieveContent'
    );

    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }
}

// ---------------------------------------------------------------------------
// MiniMax API response shapes
// ---------------------------------------------------------------------------

interface MiniMaxFileUploadResponse {
  base_resp?: { status_code: number; status_msg: string };
  file?: {
    file_id?: string | number | null;
    filename?: string;
    file_name?: string;
    bytes?: number;
    file_size?: number;
    created_at: number;
    purpose: string;
  };
}

interface MiniMaxFileListResponse {
  base_resp?: { status_code: number; status_msg: string };
  files?: Array<{
    file_id: string | number;
    filename?: string;
    file_name?: string;
    purpose: string;
    bytes?: number;
    file_size?: number;
    created_at: number;
  }>;
}

interface MiniMaxFileRetrieveResponse {
  base_resp?: { status_code: number; status_msg: string };
  file?: {
    file_id: string | number;
    filename?: string;
    file_name?: string;
    purpose: string;
    bytes?: number;
    file_size?: number;
    created_at: number;
    download_url: string;
  };
}
