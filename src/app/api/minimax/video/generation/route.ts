/**
 * POST /api/minimax/video/generation
 *
 * Creates a MiniMax H3 video generation task. The upstream call is billable
 * and not idempotent, so it is never retried: the returned task id is polled
 * separately through `/api/minimax/video/tasks/[taskId]`.
 */

import { NextResponse } from 'next/server';

import { CreateVideoGenerationSchema } from '@/application/dto/VideoDTO';
import { CreateVideoGenerationUseCase } from '@/application/use-cases/video/CreateVideoGeneration';
import { MiniMaxVideoClient } from '@/infrastructure/minimax/MiniMaxVideoClient';
import { requireAuth } from '../../../_shared/auth';
import {
  createInvalidJsonResponse,
  createValidationErrorResponse,
} from '../../_shared/route-error';
import { recordVideoTaskBestEffort } from '../../_shared/video-library-recording';
import { createVideoRouteErrorResponse } from '../_shared/video-route-error';
import { extractVideoPrompt } from '../_shared/video-prompt';

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

  const parsed = CreateVideoGenerationSchema.safeParse(body);
  if (!parsed.success) {
    return createValidationErrorResponse(parsed.error);
  }

  try {
    const useCase = new CreateVideoGenerationUseCase(new MiniMaxVideoClient());
    const result = await useCase.execute(parsed.data);

    recordVideoTaskBestEffort(
      {
        id: result.taskId,
        status: 'queued',
        taskType: 'generation',
        modality: 'video',
        model: parsed.data.model,
        resolution: parsed.data.resolution,
        duration: parsed.data.duration,
        ratio: parsed.data.ratio,
      },
      extractVideoPrompt(parsed.data.content),
    );

    return NextResponse.json(result);
  } catch (error) {
    return createVideoRouteErrorResponse(error, {
      endpoint: '/api/minimax/video/generation',
      method: 'POST',
      statusCode: 500,
    });
  }
}
