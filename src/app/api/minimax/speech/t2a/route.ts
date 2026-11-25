/**
 * POST /api/minimax/speech/t2a
 * Sync text-to-audio synthesis (≤10,000 chars).
 * Validates Authorization: Bearer <APP_ACCESS_KEY> and SynthesizeT2ASchema.
 * Returns { audio: hex } or { audioUrl: string }.
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '../../../_shared/auth';
import { SynthesizeT2ASchema } from '@/application/dto/minimax/speech/SpeechDTO';

import { SynthesizeT2AUseCase } from '@/application/use-cases/minimax/speech/SynthesizeT2A';
import { SpeechClient } from '@/infrastructure/minimax/speech/SpeechClient';
import { createInvalidJsonResponse, createMiniMaxRouteErrorResponse, createValidationErrorResponse } from '../../_shared/route-error';
import { createLocalAudioAssetBestEffort, recordGenerationBestEffort } from '../../_shared/library-recording';

export const runtime = 'nodejs';

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
  const parsed = SynthesizeT2ASchema.safeParse(body);
  if (!parsed.success) {
    return createValidationErrorResponse(parsed.error);
  }

  try {
    const useCase = new SynthesizeT2AUseCase(new SpeechClient());
    const result = await useCase.execute(parsed.data);

    if (result.audioUrl) {
      recordGenerationBestEffort({
        kind: 'tts',
        source: 'text-to-speech',
        prompt: parsed.data.text,
        model: parsed.data.model,
        metadata: { voiceId: parsed.data.voiceId },
        assets: [{
          kind: 'audio',
          storageType: 'provider_url',
          storageRef: result.audioUrl,
          format: parsed.data.format,
          mimeType: `audio/${parsed.data.format}`,
        }],
      });
      return NextResponse.json({ audioUrl: result.audioUrl });
    }

    if (result.audio) {
      const audioAsset = await createLocalAudioAssetBestEffort({
        payload: result.audio,
        format: parsed.data.format,
        mimeType: `audio/${parsed.data.format}`,
      });

      recordGenerationBestEffort({
        kind: 'tts',
        source: 'text-to-speech',
        prompt: parsed.data.text,
        model: parsed.data.model,
        metadata: { voiceId: parsed.data.voiceId },
        assets: [audioAsset],
      });
      return NextResponse.json({ audio: result.audio });
    }

    return NextResponse.json({ error: 'Unexpected empty synthesis result' }, { status: 502 });
  } catch (error) {
    return createMiniMaxRouteErrorResponse(error, {
      endpoint: '/api/minimax/speech/t2a',
      method: 'POST',
      statusCode: 500,
    });
  }
}
