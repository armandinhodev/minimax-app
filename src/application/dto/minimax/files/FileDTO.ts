import { z } from 'zod';

/**
 * File Purpose enum schema.
 *
 * NOTE: this is the legacy purpose set that `@/lib/upload-policy` still maps to
 * an explicit upload policy. The current MiniMax File API documents a different
 * purpose set per endpoint — use `FileUploadPurposeSchema`,
 * `FileListPurposeSchema` and `FileDeletePurposeSchema` for the wire contract.
 */
export const FilePurposeSchema = z.enum([
  'voice_clone',
  'prompt_audio',
  't2a_async_input',
  't2a_async',
]);

export type FilePurpose = z.infer<typeof FilePurposeSchema>;

/**
 * Purposes accepted by POST /v1/files/upload.
 * https://platform.minimax.io/docs/api-reference/file-management-upload
 */
export const FileUploadPurposeSchema = z.enum([
  'voice_clone',
  'prompt_audio',
  't2a_async_input',
  'video_understanding',
  'video_generation_input',
  'image_generation_input',
]);

export type FileUploadPurpose = z.infer<typeof FileUploadPurposeSchema>;

/**
 * Purposes accepted by GET /v1/files/list.
 * https://platform.minimax.io/docs/api-reference/file-management-list
 */
export const FileListPurposeSchema = z.enum([
  'voice_clone',
  'prompt_audio',
  't2a_async_input',
  'video_generation_input',
  'image_generation_input',
]);

export type FileListPurpose = z.infer<typeof FileListPurposeSchema>;

/**
 * Purposes accepted by POST /v1/files/delete.
 * https://platform.minimax.io/docs/api-reference/file-management-delete
 */
export const FileDeletePurposeSchema = z.enum([
  'voice_clone',
  'prompt_audio',
  't2a_async',
  't2a_async_input',
  'video_generation',
  'video_generation_input',
  'image_generation_input',
]);

export type FileDeletePurpose = z.infer<typeof FileDeletePurposeSchema>;

/** Every file purpose the MiniMax File API documents. */
export type MiniMaxFilePurpose = FileUploadPurpose | FileDeletePurpose;

/**
 * Upload File Request DTO.
 * file: multipart file content (sent as FormData, not JSON).
 * purpose: MiniMax file purpose.
 */
export const UploadFileSchema = z.object({
  purpose: FileUploadPurposeSchema,
});

export type UploadFileRequest = z.infer<typeof UploadFileSchema>;

/**
 * List Files Request DTO.
 */
export const ListFilesSchema = z.object({
  purpose: FileListPurposeSchema.optional(),
});

export type ListFilesRequest = z.infer<typeof ListFilesSchema>;

/**
 * Get File — request body.
 */
export const GetFileSchema = z.object({
  fileId: z.string().min(1, 'fileId is required'),
});

export type GetFileRequest = z.infer<typeof GetFileSchema>;

/**
 * Delete File — request body. `purpose` es obligatorio: MiniMax lo exige.
 */
export const DeleteFileSchema = z.object({
  fileId: z.string().min(1, 'fileId is required'),
  purpose: FileDeletePurposeSchema,
});

export type DeleteFileRequest = z.infer<typeof DeleteFileSchema>;

/**
 * File Metadata DTO — returned to clients.
 */
export interface FileMetadataDTO {
  fileId: string;
  fileName: string;
  purpose: MiniMaxFilePurpose;
  size: number;
  createdAt: number;
}

/**
 * Get File Response DTO — includes a fresh download URL (may expire).
 */
export interface GetFileResponse {
  file: FileMetadataDTO;
  downloadUrl: string;
  expiresAt: number; // Unix timestamp ms
}

export const FILE_PURPOSE_OPTIONS = FilePurposeSchema.options;
export const FILE_UPLOAD_PURPOSE_OPTIONS = FileUploadPurposeSchema.options;
export const FILE_LIST_PURPOSE_OPTIONS = FileListPurposeSchema.options;
export const FILE_DELETE_PURPOSE_OPTIONS = FileDeletePurposeSchema.options;

// ---------------------------------------------------------------------------
// MiniMax int64 identifiers
//
// MiniMax file/task identifiers are int64. A JavaScript number cannot hold
// every int64 exactly, so identifiers travel as decimal strings end to end and
// are only rendered as JSON integers when the exact digits are known.
// ---------------------------------------------------------------------------

/** Decimal digits accepted as a MiniMax int64 identifier. */
export const MINIMAX_INT64_PATTERN = /^\d{1,19}$/;

const RAW_INT64 = Symbol('minimax.rawInt64');

export interface RawMiniMaxInt64 {
  readonly [RAW_INT64]: string;
}

/** True when the value is a decimal identifier MiniMax accepts. */
export function isMiniMaxInt64(value: string): boolean {
  return MINIMAX_INT64_PATTERN.test(value.trim());
}

/**
 * Normalize an upstream identifier into an exact decimal string.
 * Returns null for empty or non-numeric identifiers.
 */
export function normalizeMiniMaxId(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isInteger(value)) {
    return String(value);
  }
  return null;
}

/**
 * Quote bare int64 identifiers inside a JSON document so `JSON.parse` keeps the
 * exact decimal digits instead of a lossy IEEE-754 double.
 */
export function quoteMiniMaxInt64Fields(text: string): string {
  return text.replace(/"(file_id|task_id|text_file_id)"\s*:\s*(\d{1,19})/g, '"$1":"$2"');
}

/**
 * Wrap an exact decimal identifier so it is serialized as a JSON integer.
 * Returns null when the value is not a valid MiniMax identifier.
 */
export function rawMiniMaxInt64(value: string): RawMiniMaxInt64 | null {
  const trimmed = value.trim();
  if (!isMiniMaxInt64(trimmed)) return null;
  return { [RAW_INT64]: trimmed } as RawMiniMaxInt64;
}

/**
 * JSON serializer that emits `rawMiniMaxInt64` values as exact numeric
 * literals, so int64 identifiers never lose precision.
 */
export function stringifyMiniMaxJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stringifyMiniMaxJson(item)).join(',')}]`;
  }
  if (RAW_INT64 in (value as Record<symbol, unknown>)) {
    return (value as RawMiniMaxInt64)[RAW_INT64];
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .map(([key, item]) => `${JSON.stringify(key)}:${stringifyMiniMaxJson(item)}`);
  return `{${entries.join(',')}}`;
}
