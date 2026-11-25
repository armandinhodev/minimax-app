/**
 * POST /api/minimax/music/generations
 * Generates music via MiniMax Music while keeping MINIMAX_API_KEY server-side.
 */

import { NextResponse } from 'next/server';
import { GenerateMusicUseCase } from '@/application/use-cases/minimax/music/GenerateMusic';
import { GenerateMusicSchema, isMusicCoverModel } from '@/application/dto/minimax/music/MusicDTO';
import { MusicClient } from '@/infrastructure/minimax/music/MusicClient';

import { requireAuth } from '../../../_shared/auth';
import { createInvalidJsonResponse, createMiniMaxRouteErrorResponse, createValidationErrorResponse } from '../../_shared/route-error';
import { createLocalAudioAssetBestEffort, recordGenerationBestEffort } from '../../_shared/library-recording';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createInvalidJsonResponse();
  }

  const parsed = GenerateMusicSchema.safeParse(body);
  if (!parsed.success) {
    return createValidationErrorResponse(parsed.error);
  }

  try {
    const useCase = new GenerateMusicUseCase(new MusicClient());
    const result = await useCase.execute(parsed.data);
    const audioAsset = await createLocalAudioAssetBestEffort({
      payload: result.audio,
      format: result.format,
      mimeType: 'audio/mpeg',
    });

    recordGenerationBestEffort({
      kind: 'music',
      source: parsed.data.instrumental ? 'instrumental-music' : 'text-to-music',
      prompt: parsed.data.prompt || parsed.data.lyrics,
      model: parsed.data.model,
      providerGenerationId: result.id,
      metadata: {
        lyrics: parsed.data.instrumental ? undefined : parsed.data.lyrics,
        instrumental: parsed.data.instrumental,
        durationSeconds: result.metadata.durationSeconds,
        sampleRate: result.metadata.sampleRate,
        bitrate: result.metadata.bitrate,
        traceId: result.metadata.traceId,
        coverFeatureId: isMusicCoverModel(parsed.data.model) ? parsed.data.coverFeatureId : undefined,
      },
      assets: [audioAsset],
    });
    return NextResponse.json(result);
  } catch (error) {
    return createMiniMaxRouteErrorResponse(error, {
      endpoint: '/api/minimax/music/generations',
      method: 'POST',
      statusCode: 500,
    });
  }
}
