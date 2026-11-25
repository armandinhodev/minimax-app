/**
 * POST /api/minimax/speech/t2a/async
 * Submit a long-text T2A task for async processing (text up to 1,000,000 chars).
 * Validates Authorization: Bearer <APP_ACCESS_KEY> and SubmitAsyncT2ASchema.
 * Returns { taskId: string }.
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../_shared/auth';
import { SubmitAsyncT2ASchema } from '@/application/dto/minimax/speech/SpeechDTO';

import { SubmitAsyncT2AUseCase } from '@/application/use-cases/minimax/speech/SubmitAsyncT2A';
import { SpeechClient } from '@/infrastructure/minimax/speech/SpeechClient';
import { createInvalidJsonResponse, createMiniMaxRouteErrorResponse, createValidationErrorResponse } from '../../../_shared/route-error';

export async function POST(request: Request) {
  // Auth guard
  const authError = requireAuth(request);
  if (authError) return authError;

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createInvalidJsonResponse();
  }

  // Validate schema
  const parsed = SubmitAsyncT2ASchema.safeParse(body);
  if (!parsed.success) {
    return createValidationErrorResponse(parsed.error);
  }

  try {
    const useCase = new SubmitAsyncT2AUseCase(new SpeechClient());
    const task = await useCase.execute(parsed.data);
    return NextResponse.json({ taskId: task.taskId });
  } catch (error) {
    return createMiniMaxRouteErrorResponse(error, {
      endpoint: '/api/minimax/speech/t2a/async',
      method: 'POST',
      statusCode: 500,
    });
  }
}
