import { CreateVideoGenerationSchema, type VideoCreateTaskResponse } from '@/application/dto/minimax/video/VideoDTO';
import type { IVideoClient } from '@/domain/interfaces/minimax/video/IVideoClient';

import { VideoValidationError } from './VideoValidationError';

/**
 * Creates a video generation task — `POST /v2/video_generation`.
 */
export class CreateVideoGenerationUseCase {
  constructor(private readonly videoClient: IVideoClient) {}

  async execute(request: unknown): Promise<VideoCreateTaskResponse> {
    const parsed = CreateVideoGenerationSchema.safeParse(request);

    if (!parsed.success) {
      throw new VideoValidationError(
        parsed.error.issues.map((issue) => issue.message).join('; '),
      );
    }

    return this.videoClient.createGenerationTask(parsed.data);
  }
}
