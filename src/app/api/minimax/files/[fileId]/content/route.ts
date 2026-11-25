/**
 * GET /api/minimax/files/[fileId]/content
 * Downloads the binary content of a file (GET /v1/files/retrieve_content).
 * Requires Authorization: Bearer <APP_ACCESS_KEY>.
 */

import { requireAuth } from '@/app/api/_shared/auth';
import { FileClient } from '@/infrastructure/minimax/files/FileClient';

import { createMiniMaxRouteErrorResponse } from '../../../_shared/route-error';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { fileId } = await params;

  if (!fileId) {
    return new Response('fileId is required', { status: 400 });
  }

  try {
    const bytes = await new FileClient().retrieveContent(fileId);
    return new Response(bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(bytes.byteLength),
      },
    });
  } catch (error) {
    return createMiniMaxRouteErrorResponse(error, {
      endpoint: '/api/minimax/files/[fileId]/content',
      method: 'GET',
      statusCode: 500,
    });
  }
}
