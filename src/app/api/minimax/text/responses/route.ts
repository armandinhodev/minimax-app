/**
 * POST /api/minimax/text/responses
 * Chat completion against the OpenAI Responses-compatible MiniMax surface
 * (POST /v1/responses).
 * Validates Authorization: Bearer <APP_ACCESS_KEY>.
 */

import { NextResponse } from 'next/server';

import { CompleteChatUseCase } from '@/application/use-cases/minimax/text/CompleteChat';
import { TextClient } from '@/infrastructure/minimax/text/TextClient';

import { requireAuth } from '@/app/api/_shared/auth';
import { createInvalidJsonResponse, createMiniMaxRouteErrorResponse } from '../../_shared/route-error';
import { parseChatRequest } from '../_shared/text-request';

export async function POST(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createInvalidJsonResponse();
  }

  const parsed = parseChatRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  try {
    const useCase = new CompleteChatUseCase(new TextClient());
    const result = await useCase.execute(parsed.data, 'responses');
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.name === 'CompleteChatValidationError') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return createMiniMaxRouteErrorResponse(error, {
      endpoint: '/api/minimax/text/responses',
      method: 'POST',
      statusCode: 500,
    });
  }
}
