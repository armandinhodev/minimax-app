/**
 * POST /api/minimax/image/context-ir
 * Runs the MiniMax-H3-Image prompt enhancement on its own and returns the
 * enhanced prompt without generating any image.
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '../../../_shared/auth';
import { ImageContextIRRequestSchema } from '@/application/dto/minimax/image/ImageDTO';
import { EnhanceImagePromptUseCase, EnhanceImagePromptValidationError } from '@/application/use-cases/minimax/image/EnhanceImagePrompt';
import { ImageClient, MiniMaxImageError } from '@/infrastructure/minimax/image/ImageClient';
import { createInvalidJsonResponse, createMiniMaxRouteErrorResponse, createValidationErrorResponse } from '../../_shared/route-error';

export const runtime = 'nodejs';

function createImageErrorResponse(error: unknown): NextResponse {
  if (error instanceof EnhanceImagePromptValidationError) {
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
    endpoint: '/api/minimax/image/context-ir',
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

  const parsed = ImageContextIRRequestSchema.safeParse(body);
  if (!parsed.success) {
    return createValidationErrorResponse(parsed.error);
  }

  try {
    const useCase = new EnhanceImagePromptUseCase(new ImageClient());
    const result = await useCase.execute(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return createImageErrorResponse(error);
  }
}
