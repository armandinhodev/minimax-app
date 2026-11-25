/**
 * POST /api/minimax/music/generations/cover-preprocess
 * Preprocesses reference audio for MiniMax Music Cover while keeping MINIMAX_API_KEY server-side.
 */

import { NextResponse } from 'next/server';
import { PreprocessMusicCoverUseCase } from '@/application/use-cases/minimax/music/PreprocessMusicCover';
import { MusicClient } from '@/infrastructure/minimax/music/MusicClient';
import { MusicCoverPreprocessSchema } from '@/application/dto/minimax/music/MusicDTO';

import { requireAuth } from '../../../_shared/auth';
import { recordGenerationBestEffort } from '../../_shared/library-recording';
import { createInvalidJsonResponse, createMiniMaxRouteErrorResponse, createValidationErrorResponse } from '../../_shared/route-error';

export const runtime = 'nodejs';

const COVER_FEATURE_TTL_MS = 24 * 60 * 60 * 1000;

function getUploadByteLength(audioBase64: string): number {
  const payload = audioBase64.replace(/^data:audio\/[a-z0-9.+-]+;base64,/i, '');
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return (payload.length / 4) * 3 - padding;
}

function getReferenceAudioMetadata(input: { audioUrl: string; audioBase64: string }): Record<string, unknown> {
  if (input.audioUrl.trim()) {
    return {
      source: 'url',
      audioUrl: input.audioUrl.trim(),
    };
  }

  return {
    source: 'upload',
    byteLength: getUploadByteLength(input.audioBase64),
    dataUrl: /^data:audio\/[a-z0-9.+-]+;base64,/i.test(input.audioBase64),
  };
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

  const parsed = MusicCoverPreprocessSchema.safeParse(body);
  if (!parsed.success) {
    return createValidationErrorResponse(parsed.error);
  }

  try {
    const useCase = new PreprocessMusicCoverUseCase(new MusicClient());
    const result = await useCase.execute(parsed.data);
    const expiresAt = Date.now() + COVER_FEATURE_TTL_MS;

    const libraryGeneration = recordGenerationBestEffort({
      kind: 'music',
      source: 'cover-preprocess',
      title: 'Cover preprocess',
      prompt: result.formattedLyrics,
      model: parsed.data.model,
      providerGenerationId: result.coverFeatureId,
      metadata: {
        coverFeatureId: result.coverFeatureId,
        formattedLyrics: result.formattedLyrics,
        structureResult: result.structureResult,
        audioDurationSeconds: result.audioDurationSeconds,
        traceId: result.traceId,
        expiresAt,
        referenceAudio: getReferenceAudioMetadata(parsed.data),
        providerMetadata: result.metadata,
      },
      assets: [
        {
          kind: 'metadata',
          storageType: 'metadata_only',
          expiresAt,
          metadata: {
            artifact: 'cover-preprocess',
            coverFeatureId: result.coverFeatureId,
          },
          role: 'cover_feature',
        },
      ],
    });

    return NextResponse.json({
      ...result,
      coverPreprocessId: libraryGeneration?.id,
    });
  } catch (error) {
    return createMiniMaxRouteErrorResponse(error, {
      endpoint: '/api/minimax/music/generations/cover-preprocess',
      method: 'POST',
      statusCode: 500,
    });
  }
}
