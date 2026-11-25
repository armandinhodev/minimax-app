/**
 * POST /api/minimax/video/regeneration
 *
 * Creates a 2K regeneration task from an existing 768P task id or from a
 * 768P base video. Like every create call it is never retried.
 */

import { NextResponse } from 'next/server';

import { CreateVideoRegenerationSchema } from '@/application/dto/VideoDTO';
import { CreateVideoRegenerationUseCase } from '@/application/use-cases/video/CreateVideoRegeneration';
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

  const parsed = CreateVideoRegenerationSchema.safeParse(body);
  if (!parsed.success) {
    return createValidationErrorResponse(parsed.error);
  }

  try {
    const useCase = new CreateVideoRegenerationUseCase(new MiniMaxVideoClient());
    const result = await useCase.execute(parsed.data);

    recordVideoTaskBestEffort(
      {
        id: result.taskId,
        status: 'queued',
        taskType: 'regeneration',
        modality: 'video',
        model: parsed.data.model,
        resolution: parsed.data.resolution,
      },
      parsed.data.content ? extractVideoPrompt(parsed.data.content) : undefined,
    );

    return NextResponse.json(result);
  } catch (error) {
    return createVideoRouteErrorResponse(error, {
      endpoint: '/api/minimax/video/regeneration',
      method: 'POST',
      statusCode: 500,
    });
  }
}
