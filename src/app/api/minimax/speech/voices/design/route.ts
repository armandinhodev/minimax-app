/**
 * POST /api/minimax/speech/voices/design
 * Design a voice from a natural-language prompt.
 * Validates Authorization: Bearer <APP_ACCESS_KEY> and DesignVoiceSchema.
 * Returns { voice, trialAudio?, trialAudioUrl? }.
 * trialAudio is hex-encoded for AudioPlayer playback.
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../_shared/auth';
import { DesignVoiceSchema } from '@/application/dto/minimax/speech/VoiceDTO';

import { DesignVoiceUseCase } from '@/application/use-cases/minimax/speech/DesignVoice';
import { SpeechClient } from '@/infrastructure/minimax/speech/SpeechClient';
import { createMiniMaxRouteErrorResponse } from '../../../_shared/route-error';

export async function POST(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = DesignVoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((e: { message: string }) => e.message).join('; ') },
      { status: 400 }
    );
  }

  try {
    const useCase = new DesignVoiceUseCase(new SpeechClient());
    const result = await useCase.execute(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return createMiniMaxRouteErrorResponse(error, {
      endpoint: '/api/minimax/speech/voices/design',
      method: 'POST',
      statusCode: 500,
    });
  }
}
