/**
 * POST /api/minimax/speech/t2a/websocket
 * Synthesize speech over the MiniMax WebSocket transport.
 *
 * The browser cannot hold the WebSocket: MiniMax authenticates it with the
 * API key. So the server opens the socket and relays the audio to the
 * browser as Server-Sent Events.
 * Validates Authorization: Bearer <APP_ACCESS_KEY>.
 */

import { NextResponse } from 'next/server';

import { StreamSpeechWebSocketUseCase } from '@/application/use-cases/minimax/speech/StreamSpeechWebSocket';
import { SpeechWebSocketClient } from '@/infrastructure/minimax/speech/SpeechWebSocketClient';

import { requireAuth } from '@/app/api/_shared/auth';
import { createInvalidJsonResponse, createMiniMaxRouteErrorResponse } from '../../../_shared/route-error';

export async function POST(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createInvalidJsonResponse();
  }

  const payload = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;

  try {
    const useCase = new StreamSpeechWebSocketUseCase(new SpeechWebSocketClient());
    const stream = await useCase.execute({
      text: typeof payload.text === 'string' ? payload.text : '',
      voiceId: typeof payload.voiceId === 'string' ? payload.voiceId : '',
      model: typeof payload.model === 'string' ? payload.model : undefined,
      speed: typeof payload.speed === 'number' ? payload.speed : undefined,
      volume: typeof payload.volume === 'number' ? payload.volume : undefined,
      pitch: typeof payload.pitch === 'number' ? payload.pitch : undefined,
      format: typeof payload.format === 'string' ? payload.format : undefined,
      sampleRate: typeof payload.sampleRate === 'number' ? payload.sampleRate : undefined,
      channel: typeof payload.channel === 'number' ? payload.channel : undefined,
      languageBoost: typeof payload.languageBoost === 'string' ? payload.languageBoost : undefined,
    });

    return new Response(stream as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'StreamSpeechWebSocketValidationError') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return createMiniMaxRouteErrorResponse(error, {
      endpoint: '/api/minimax/speech/t2a/websocket',
      method: 'POST',
      statusCode: 500,
    });
  }
}
