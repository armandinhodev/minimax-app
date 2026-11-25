import {
  VideoListTasksQuerySchema,
  VideoTaskIdSchema,
  type VideoListTasksResponse,
  type VideoModel,
  type VideoTaskStatus,
  type VideoTaskType,
} from '@/application/dto/VideoDTO';
import type { IMiniMaxVideoClient } from '@/domain/interfaces/IMiniMaxVideoClient';

import { VideoValidationError } from './VideoValidationError';

export interface ListVideoTasksInput {
  page?: number;
  pageSize?: number;
  status?: VideoTaskStatus;
  taskType?: VideoTaskType;
  model?: VideoModel;
  taskIds?: string[];
}

/**
 * Lists video tasks — `GET /v2/query/video_generation`.
 */
export class ListVideoTasksUseCase {
  constructor(private readonly videoClient: IMiniMaxVideoClient) {}

  async execute(input: ListVideoTasksInput): Promise<VideoListTasksResponse> {
    const parsed = VideoListTasksQuerySchema.safeParse({
      page: input.page,
      pageSize: input.pageSize,
      status: input.status,
      taskType: input.taskType,
      model: input.model,
    });

    if (!parsed.success) {
      throw new VideoValidationError(
        parsed.error.issues.map((issue) => issue.message).join('; '),
      );
    }

    const taskIds = input.taskIds ?? [];
    for (const taskId of taskIds) {
      const parsedTaskId = VideoTaskIdSchema.safeParse(taskId);
      if (!parsedTaskId.success) {
        throw new VideoValidationError(
          parsedTaskId.error.issues.map((issue) => issue.message).join('; '),
        );
      }
    }

    return this.videoClient.listTasks({
      pageNum: parsed.data.page,
      pageSize: parsed.data.pageSize,
      status: parsed.data.status,
      taskType: parsed.data.taskType,
      model: parsed.data.model,
      taskIds: taskIds.length > 0 ? taskIds : undefined,
    });
  }
}
