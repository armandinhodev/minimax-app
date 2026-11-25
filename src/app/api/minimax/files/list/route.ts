/**
 * GET /api/minimax/files/list
 * List files, optionally filtered by purpose.
 * Query params: purpose (optional, one of the documented list purposes).
 * Validates Authorization: Bearer <APP_ACCESS_KEY>.
 * Returns { files: FileMetadataDTO[] }.
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '../../../_shared/auth';
import { MiniMaxFileClient } from '@/infrastructure/minimax/MiniMaxFileClient';
import type { FileListPurpose } from '@/application/dto/FileDTO';
import { ListFilesRequestSchema } from '@/lib/validators';
import { createMiniMaxRouteErrorResponse, createValidationErrorResponse } from '../../_shared/route-error';

export async function GET(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const parsed = ListFilesRequestSchema.safeParse({
    purpose: url.searchParams.get('purpose') ?? undefined,
  });

  if (!parsed.success) {
    return createValidationErrorResponse(parsed.error);
  }

  try {
    const client = new MiniMaxFileClient();
    const files = await client.listFiles(parsed.data.purpose as FileListPurpose | undefined);
    return NextResponse.json({ files });
  } catch (error) {
    return createMiniMaxRouteErrorResponse(error, {
      endpoint: '/api/minimax/files/list',
      method: 'GET',
      statusCode: 500,
    });
  }
}
