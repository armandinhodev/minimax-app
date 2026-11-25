/**
 * /api/minimax/files
 * POST: upload a file to MiniMax (generic — purpose determines usage).
 *   Accepts multipart/form-data: file (File), purpose (string).
 * GET: list files, optionally filtered by purpose.
 *   Query params: purpose (optional, one of the documented list purposes).
 * Validates Authorization: Bearer <APP_ACCESS_KEY>.
 *
 * Purposes follow the current MiniMax upload contract
 * (voice_clone | prompt_audio | t2a_async_input | video_understanding |
 *  video_generation_input | image_generation_input).
 *
 * Server-side validation by purpose:
 * - voice_clone / prompt_audio : mp3/m4a/wav only, ≤20 MB
 * - t2a_async_input           : txt/zip only, ≤20 MB
 * - documented media purposes : extension checked by MiniMax, ≤20 MB
 *
 * POST returns { fileId, fileName, purpose, size, createdAt }.
 * GET returns { files: FileMetadataDTO[] }.
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '../../_shared/auth';
import { UploadFileUseCase } from '@/application/use-cases/minimax/files/UploadFile';
import { FileClient } from '@/infrastructure/minimax/files/FileClient';
import {
  FILE_PURPOSE_OPTIONS,
  FILE_UPLOAD_PURPOSE_OPTIONS,
  FileUploadPurposeSchema,
  ListFilesSchema,
  type FileListPurpose,
  type FilePurpose,
  type FileUploadPurpose,
} from '@/application/dto/minimax/files/FileDTO';
import { MAX_UPLOAD_FILE_SIZE_BYTES, MAX_UPLOAD_FILE_SIZE_MB } from '@/lib/upload-policy';
import { validateFileForPurpose } from '@/lib/upload-validation';
import { createMiniMaxRouteErrorResponse, createValidationErrorResponse } from '../_shared/route-error';
import { recordUploadFailure } from '@/lib/telemetry';

/** Purposes that have a dedicated entry in the shared upload policy. */
function hasSharedUploadPolicy(purpose: FileUploadPurpose): purpose is Extract<FileUploadPurpose, FilePurpose> {
  return (FILE_PURPOSE_OPTIONS as readonly string[]).includes(purpose);
}

export async function POST(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;

  // Chunked requests may omit Content-Length; validate the actual multipart payload instead.
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  const purposeStr = formData.get('purpose') as string | null;

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'file (File) is required' }, { status: 400 });
  }
  if (!purposeStr || typeof purposeStr !== 'string') {
    return NextResponse.json({ error: 'purpose is required' }, { status: 400 });
  }

  const parsedPurpose = FileUploadPurposeSchema.safeParse(purposeStr);
  if (!parsedPurpose.success) {
    return NextResponse.json(
      { error: `purpose must be one of: ${FILE_UPLOAD_PURPOSE_OPTIONS.join(', ')}` },
      { status: 400 }
    );
  }

  const purpose = parsedPurpose.data;

  let fileBuffer: Buffer;
  try {
    const arrayBuffer = await file.arrayBuffer();
    fileBuffer = Buffer.from(arrayBuffer);
  } catch {
    return NextResponse.json({ error: 'Failed to read file' }, { status: 400 });
  }

  // Server-side purpose+type/content/size validation
  const validationError = hasSharedUploadPolicy(purpose)
    ? validateFileForPurpose(file.name, file.type, file.size, fileBuffer, purpose)
    : file.size > MAX_UPLOAD_FILE_SIZE_BYTES
      ? `File too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Maximum is ${MAX_UPLOAD_FILE_SIZE_MB} MB.`
      : null;
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const useCase = new UploadFileUseCase(new FileClient());
    const result = await useCase.execute({
      fileBuffer,
      fileName: file.name,
      purpose,
    });
    return NextResponse.json(result);
  } catch (error) {
    recordUploadFailure(error, {
      endpoint: '/api/minimax/files',
      method: 'POST',
      statusCode: 500,
      operation: 'file.upload',
    });
    return createMiniMaxRouteErrorResponse(error, {
      endpoint: '/api/minimax/files',
      method: 'POST',
      statusCode: 500,
    });
  }
}

export async function GET(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const parsed = ListFilesSchema.safeParse({
    purpose: url.searchParams.get('purpose') ?? undefined,
  });

  if (!parsed.success) {
    return createValidationErrorResponse(parsed.error);
  }

  try {
    const client = new FileClient();
    const files = await client.listFiles(parsed.data.purpose as FileListPurpose | undefined);
    return NextResponse.json({ files });
  } catch (error) {
    return createMiniMaxRouteErrorResponse(error, {
      endpoint: '/api/minimax/files',
      method: 'GET',
      statusCode: 500,
    });
  }
}
