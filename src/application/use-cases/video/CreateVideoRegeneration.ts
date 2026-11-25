import {
  CreateVideoRegenerationSchema,
  type VideoCreateTaskResponse,
} from '@/application/dto/VideoDTO';
import type { IMiniMaxVideoClient } from '@/domain/interfaces/IMiniMaxVideoClient';

import { VideoValidationError } from './VideoValidationError';

/**
 * Creates a video regeneration task — `POST /v2/video_regeneration`.
 *
 * The source is either an existing task id or a 768P base video.
 */
export class CreateVideoRegenerationUseCase {
  constructor(private readonly videoClient: IMiniMaxVideoClient) {}

  async execute(request: unknown): Promise<VideoCreateTaskResponse> {
    const parsed = CreateVideoRegenerationSchema.safeParse(request);

    if (!parsed.success) {
      throw new VideoValidationError(
        parsed.error.issues.map((issue) => issue.message).join('; '),
      );
    }

    return this.videoClient.createRegenerationTask(parsed.data);
  }
}
