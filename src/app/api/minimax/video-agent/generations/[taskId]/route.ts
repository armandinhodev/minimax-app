/**
 * GET /api/minimax/video-agent/generations/[taskId]
 * Reads the status of a Video Agent task
 * (GET /v1/query/video_template_generation).
 * Validates Authorization: Bearer <APP_ACCESS_KEY>.
 */

import { NextResponse } from 'next/server';

import { QueryVideoAgentTaskUseCase } from '@/application/use-cases/minimax/video-agent/QueryVideoAgentTask';
import { VideoAgentClient } from '@/infrastructure/minimax/video-agent/VideoAgentClient';

import { requireAuth } from '@/app/api/_shared/auth';
import { createMiniMaxRouteErrorResponse } from '../../../_shared/route-error';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { taskId } = await params;

  try {
    const useCase = new QueryVideoAgentTaskUseCase(new VideoAgentClient());
    const task = await useCase.execute(taskId);
    return NextResponse.json(task);
  } catch (error) {
    if (error instanceof Error && error.name === 'QueryVideoAgentTaskValidationError') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return createMiniMaxRouteErrorResponse(error, {
      endpoint: '/api/minimax/video-agent/generations/[taskId]',
      method: 'GET',
      statusCode: 500,
    });
  }
}
