/**
 * POST /api/minimax/speech/t2a/stream
 * SSE streaming text-to-audio synthesis (≤10,000 chars).
 * Validates Authorization: Bearer <APP_ACCESS_KEY> and StreamT2ASchema.
 * Returns text/event-stream with raw SSE chunks forwarded from MiniMax.
 *
 * JSON body: { text, voiceId, model? }
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../_shared/auth';
import { StreamT2ASchema } from '@/application/dto/minimax/speech/SpeechDTO';

import { StreamT2AUseCase } from '@/application/use-cases/minimax/speech/StreamT2A';
import { SpeechClient } from '@/infrastructure/minimax/speech/SpeechClient';
import { createMiniMaxRouteErrorResponse, createValidationErrorResponse } from '../../../_shared/route-error';

export async function POST(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = StreamT2ASchema.safeParse(body);
  if (!parsed.success) return createValidationErrorResponse(parsed.error);

  try {
    const useCase = new StreamT2AUseCase(new SpeechClient());
    const stream = await useCase.execute(parsed.data);
    request.signal.addEventListener('abort', () => {
      void stream.cancel('client disconnected');
    }, { once: true });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    return createMiniMaxRouteErrorResponse(error, {
      endpoint: '/api/minimax/speech/t2a/stream',
      method: 'POST',
      statusCode: 500,
    });
  }
}
