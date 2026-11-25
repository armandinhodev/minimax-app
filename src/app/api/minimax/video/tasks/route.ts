/**
 * GET /api/minimax/video/tasks
 *
 * Lists the MiniMax H3 tasks created during the last 7 days, with optional
 * filters for status, task type, model and task ids.
 */

import { NextResponse } from 'next/server';

import { VideoListTasksQuerySchema } from '@/application/dto/VideoDTO';
import { ListVideoTasksUseCase } from '@/application/use-cases/video/ListVideoTasks';
import { MiniMaxVideoClient } from '@/infrastructure/minimax/MiniMaxVideoClient';
import { requireAuth } from '../../../_shared/auth';
import { createValidationErrorResponse } from '../../_shared/route-error';
import { recordVideoTaskBestEffort } from '../../_shared/video-library-recording';
import { createVideoRouteErrorResponse } from '../_shared/video-route-error';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const searchParams = new URL(request.url).searchParams;
  const parsed = VideoListTasksQuerySchema.safeParse({
    page: searchParams.get('page') ?? undefined,
    pageSize: searchParams.get('pageSize') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    taskType: searchParams.get('taskType') ?? undefined,
    model: searchParams.get('model') ?? undefined,
    taskIds: searchParams.get('taskIds') ?? undefined,
  });

  if (!parsed.success) {
    return createValidationErrorResponse(parsed.error);
  }

  const taskIds = parsed.data.taskIds
    ? parsed.data.taskIds.split(',').map((value) => value.trim()).filter((value) => value.length > 0)
    : undefined;

  try {
    const useCase = new ListVideoTasksUseCase(new MiniMaxVideoClient());
    const result = await useCase.execute({
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      status: parsed.data.status,
      taskType: parsed.data.taskType,
      model: parsed.data.model,
      taskIds,
    });

    for (const task of result.items) {
      recordVideoTaskBestEffort(task);
    }

    return NextResponse.json(result);
  } catch (error) {
    return createVideoRouteErrorResponse(error, {
      endpoint: '/api/minimax/video/tasks',
      method: 'GET',
      statusCode: 500,
    });
  }
}
