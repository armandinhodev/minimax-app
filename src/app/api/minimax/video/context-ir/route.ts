/**
 * POST /api/minimax/video/context-ir
 *
 * Creates an H3-Context-IR task. The upstream task returns an enriched
 * prompt, never a video: the result is polled and read from `content.prompt`.
 */

import { NextResponse } from 'next/server';

import { CreateVideoContextIRSchema } from '@/application/dto/minimax/video/VideoDTO';
import { CreateVideoContextIRUseCase } from '@/application/use-cases/minimax/video/CreateVideoContextIR';
import { VideoClient } from '@/infrastructure/minimax/video/VideoClient';
import { requireAuth } from '../../../_shared/auth';
import { createInvalidJsonResponse, createValidationErrorResponse } from '../../_shared/route-error';
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

  const parsed = CreateVideoContextIRSchema.safeParse(body);
  if (!parsed.success) {
    return createValidationErrorResponse(parsed.error);
  }

  try {
    const useCase = new CreateVideoContextIRUseCase(new VideoClient());
    const result = await useCase.execute(parsed.data);

    recordVideoTaskBestEffort(
      {
        id: result.taskId,
        status: 'queued',
        taskType: 'h3_context_ir',
        modality: 'text',
        model: parsed.data.model,
        duration: parsed.data.duration,
        ratio: parsed.data.ratio,
      },
      extractVideoPrompt(parsed.data.content),
    );

    return NextResponse.json(result);
  } catch (error) {
    return createVideoRouteErrorResponse(error, {
      endpoint: '/api/minimax/video/context-ir',
      method: 'POST',
      statusCode: 500,
    });
  }
}
