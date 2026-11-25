import { VideoTaskIdSchema, type VideoTaskResponse } from '@/application/dto/minimax/video/VideoDTO';
import type { IVideoClient } from '@/domain/interfaces/minimax/video/IVideoClient';

import { VideoValidationError } from './VideoValidationError';

/**
 * Queries a single video task — `GET /v2/query/video_generation/{task_id}`.
 */
export class QueryVideoTaskUseCase {
  constructor(private readonly videoClient: IVideoClient) {}

  async execute(taskId: string): Promise<VideoTaskResponse> {
    const parsed = VideoTaskIdSchema.safeParse(taskId);

    if (!parsed.success) {
      throw new VideoValidationError(
        parsed.error.issues.map((issue) => issue.message).join('; '),
      );
    }

    return this.videoClient.queryTask(parsed.data);
  }
}
