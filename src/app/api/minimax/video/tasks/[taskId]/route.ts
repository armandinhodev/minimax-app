/**
 * GET  /api/minimax/video/tasks/[taskId] — task status and result.
 * DELETE /api/minimax/video/tasks/[taskId] — cancel a queued task or delete a
 * finished task record.
 *
 * The upstream endpoint picks the cancel/delete action from the current task
 * status, so the local route never decides which one applies.
 */

import { NextResponse } from 'next/server';

import {
  VideoTaskIdSchema,
  VideoTaskTypeSchema,
  type VideoTaskType,
} from '@/application/dto/VideoDTO';
import { CancelVideoTaskUseCase } from '@/application/use-cases/video/CancelVideoTask';
import { QueryVideoTaskUseCase } from '@/application/use-cases/video/QueryVideoTask';
import { MiniMaxVideoClient } from '@/infrastructure/minimax/MiniMaxVideoClient';
import { requireAuth } from '../../../../_shared/auth';
import { createValidationErrorResponse } from '../../../_shared/route-error';
import { recordVideoTaskBestEffort } from '../../../_shared/video-library-recording';
import { createVideoRouteErrorResponse } from '../../_shared/video-route-error';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ taskId: string }>;
}

/**
 * Reads the optional task type from the query string or the request body.
 * The value is validated before it reaches the Library recorder.
 */
async function readTaskType(request: Request): Promise<VideoTaskType | undefined> {
  const fromQuery = new URL(request.url).searchParams.get('taskType');

  if (fromQuery) {
    const parsed = VideoTaskTypeSchema.safeParse(fromQuery);
    return parsed.success ? parsed.data : undefined;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return undefined;
  }

  const candidate = (body as { taskType?: unknown } | null)?.taskType;
  if (typeof candidate !== 'string') return undefined;

  const parsed = VideoTaskTypeSchema.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
}

export async function GET(request: Request, context: RouteContext) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { taskId } = await context.params;

  // The task id is validated before it can reach an upstream URL.
  const parsedTaskId = VideoTaskIdSchema.safeParse(taskId);
  if (!parsedTaskId.success) {
    return createValidationErrorResponse(parsedTaskId.error);
  }

  try {
    const useCase = new QueryVideoTaskUseCase(new MiniMaxVideoClient());
    const result = await useCase.execute(parsedTaskId.data);

    recordVideoTaskBestEffort(result.task);

    return NextResponse.json(result);
  } catch (error) {
    return createVideoRouteErrorResponse(error, {
      endpoint: '/api/minimax/video/tasks/[taskId]',
      method: 'GET',
      statusCode: 500,
    });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { taskId } = await context.params;
  const taskType = await readTaskType(request);

  const parsedTaskId = VideoTaskIdSchema.safeParse(taskId);
  if (!parsedTaskId.success) {
    return createValidationErrorResponse(parsedTaskId.error);
  }

  try {
    const useCase = new CancelVideoTaskUseCase(new MiniMaxVideoClient());
    const result = await useCase.execute({ taskId: parsedTaskId.data, taskType });

    // A cancelled task is still part of the local history, so it is recorded
    // with its cancelled status. A deleted upstream record leaves the local
    // Library untouched: the finished output stays available.
    if (result.action === 'cancelled') {
      recordVideoTaskBestEffort({
        id: result.taskId,
        status: 'cancelled',
        taskType: taskType ?? 'generation',
        modality: taskType === 'h3_context_ir' ? 'text' : 'video',
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    return createVideoRouteErrorResponse(error, {
      endpoint: '/api/minimax/video/tasks/[taskId]',
      method: 'DELETE',
      statusCode: 500,
    });
  }
}
