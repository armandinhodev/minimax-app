/**
 * POST /api/minimax/image
 * Generates images via the MiniMax H3 image API while keeping MINIMAX_API_KEY server-side.
 *
 * Requests without reference images are sent to the text-to-image endpoint;
 * requests with 1 to 16 reference images are sent to the image edit endpoint.
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '../../_shared/auth';
import { GenerateImageRequestSchema } from '@/lib/validators';
import { GenerateImageUseCase, GenerateImageValidationError } from '@/application/use-cases/image/GenerateImage';
import { MiniMaxImageClient, MiniMaxImageError } from '@/infrastructure/minimax/MiniMaxImageClient';
import {
  createInvalidJsonResponse,
  createMiniMaxRouteErrorResponse,
  createValidationErrorResponse,
} from '../_shared/route-error';
import { recordGenerationBestEffort } from '../_shared/library-recording';

export const runtime = 'nodejs';

const ASSET_MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

/**
 * Upstream client errors (invalid parameters, unsupported content) are reported
 * verbatim so the user can act on them. Rate limits and server errors keep the
 * shared retryable messaging.
 */
function createImageErrorResponse(error: unknown): NextResponse {
  if (error instanceof GenerateImageValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (
    error instanceof MiniMaxImageError
    && typeof error.status === 'number'
    && error.status >= 400
    && error.status < 500
    && error.status !== 429
  ) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }

  return createMiniMaxRouteErrorResponse(error, {
    endpoint: '/api/minimax/image',
    method: 'POST',
    statusCode: 500,
  });
}

export async function POST(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createInvalidJsonResponse();
  }

  const parsed = GenerateImageRequestSchema.safeParse(body);
  if (!parsed.success) {
    return createValidationErrorResponse(parsed.error);
  }

  try {
    const useCase = new GenerateImageUseCase(new MiniMaxImageClient());
    const result = await useCase.execute(parsed.data);
    const outputFormat = result.metadata.outputFormat;

    recordGenerationBestEffort({
      kind: 'image',
      source: parsed.data.images?.length ? 'image-to-image' : 'text-to-image',
      prompt: parsed.data.prompt,
      model: parsed.data.model,
      providerGenerationId: result.id,
      metadata: {
        aspectRatio: parsed.data.aspectRatio ?? null,
        area: parsed.data.area ?? null,
        size: parsed.data.size ?? null,
        n: parsed.data.n,
        outputFormat,
        disablePromptEnhanced: parsed.data.disablePromptEnhanced,
        successCount: result.metadata.successCount,
        failedCount: result.metadata.failedCount,
        requestId: result.metadata.requestId,
      },
      assets: result.images
        .filter((item) => item.url !== null)
        .map((item) => ({
          kind: 'image',
          storageType: 'provider_url',
          storageRef: item.url,
          format: outputFormat,
          mimeType: ASSET_MIME_TYPES[outputFormat] ?? 'image/jpeg',
          expiresAt: result.expiresAt,
          metadata: {
            index: item.index,
            size: item.size,
            revisedPrompt: item.revisedPrompt,
          },
        })),
    });

    return NextResponse.json(result);
  } catch (error) {
    return createImageErrorResponse(error);
  }
}
