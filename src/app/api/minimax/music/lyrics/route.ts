/**
 * POST /api/minimax/music/generations/lyrics
 * Generates lyrics via MiniMax Music while keeping MINIMAX_API_KEY server-side.
 */

import { NextResponse } from 'next/server';
import { GenerateLyricsUseCase } from '@/application/use-cases/minimax/music/GenerateLyrics';
import { MusicClient } from '@/infrastructure/minimax/music/MusicClient';
import { GenerateLyricsSchema } from '@/application/dto/minimax/music/MusicDTO';

import { requireAuth } from '../../../_shared/auth';
import { createInvalidJsonResponse, createMiniMaxRouteErrorResponse, createValidationErrorResponse } from '../../_shared/route-error';

export async function POST(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createInvalidJsonResponse();
  }

  const parsed = GenerateLyricsSchema.safeParse(body);
  if (!parsed.success) {
    return createValidationErrorResponse(parsed.error);
  }

  try {
    const useCase = new GenerateLyricsUseCase(new MusicClient());
    const result = await useCase.execute(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return createMiniMaxRouteErrorResponse(error, {
      endpoint: '/api/minimax/music/generations/lyrics',
      method: 'POST',
      statusCode: 500,
    });
  }
}
