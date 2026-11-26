/**
 * POST /api/minimax/video-agent/generations
 * Creates a Video Agent template task (POST /v1/video_template_generation).
 * Validates Authorization: Bearer <APP_ACCESS_KEY>.
 */

import { NextResponse } from 'next/server';

import { CreateVideoAgentTaskUseCase } from '@/application/use-cases/minimax/video-agent/CreateVideoAgentTask';
import { VideoAgentClient } from '@/infrastructure/minimax/video-agent/VideoAgentClient';

import { requireAuth } from '@/app/api/_shared/auth';
import { createInvalidJsonResponse, createMiniMaxRouteErrorResponse } from '../../_shared/route-error';

export async function POST(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createInvalidJsonResponse();
  }

  const payload = (typeof body === 'object' && body !== null ? body : {}) as {
    templateId?: unknown;
    textInputs?: unknown;
    mediaInputs?: unknown;
    callbackUrl?: unknown;
  };

  const asInputs = (value: unknown): Array<{ value: string }> => {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
      if (typeof entry === 'string') return [{ value: entry }];
      if (typeof entry === 'object' && entry !== null && typeof (entry as { value?: unknown }).value === 'string') {
        return [{ value: (entry as { value: string }).value }];
      }
      return [];
    });
  };

  try {
    const useCase = new CreateVideoAgentTaskUseCase(new VideoAgentClient());
    const result = await useCase.execute({
      templateId: typeof payload.templateId === 'string' ? payload.templateId : '',
      textInputs: asInputs(payload.textInputs),
      mediaInputs: asInputs(payload.mediaInputs),
      callbackUrl: typeof payload.callbackUrl === 'string' ? payload.callbackUrl : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.name === 'CreateVideoAgentTaskValidationError') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return createMiniMaxRouteErrorResponse(error, {
      endpoint: '/api/minimax/video-agent/generations',
      method: 'POST',
      statusCode: 500,
    });
  }
}
