import { VideoTaskIdSchema, VideoTaskTypeSchema, type VideoTaskActionResponse, type VideoTaskType } from '@/application/dto/minimax/video/VideoDTO';
import type { IVideoClient } from '@/domain/interfaces/minimax/video/IVideoClient';

import { VideoValidationError } from './VideoValidationError';

export interface CancelVideoTaskInput {
  taskId: string;
  taskType?: VideoTaskType;
}

/**
 * Cancels a queued task or deletes a finished task record.
 *
 * The upstream endpoint picks the action from the current task status, so the
 * local side never decides whether a task is cancelled or deleted.
 */
export class CancelVideoTaskUseCase {
  constructor(private readonly videoClient: IVideoClient) {}

  async execute(input: CancelVideoTaskInput): Promise<VideoTaskActionResponse> {
    const parsedTaskId = VideoTaskIdSchema.safeParse(input.taskId);

    if (!parsedTaskId.success) {
      throw new VideoValidationError(
        parsedTaskId.error.issues.map((issue) => issue.message).join('; '),
      );
    }

    if (input.taskType !== undefined) {
      const parsedTaskType = VideoTaskTypeSchema.safeParse(input.taskType);
      if (!parsedTaskType.success) {
        throw new VideoValidationError(
          parsedTaskType.error.issues.map((issue) => issue.message).join('; '),
        );
      }
    }

    return this.videoClient.cancelOrDeleteTask(parsedTaskId.data);
  }
}
