import { CreateVideoContextIRSchema, type VideoCreateTaskResponse } from '@/application/dto/minimax/video/VideoDTO';
import type { IVideoClient } from '@/domain/interfaces/minimax/video/IVideoClient';

import { VideoValidationError } from './VideoValidationError';

/**
 * Creates an H3-Context-IR task — `POST /v2/h3_context_ir`.
 *
 * The upstream task returns an enriched prompt, never a video.
 */
export class CreateVideoContextIRUseCase {
  constructor(private readonly videoClient: IVideoClient) {}

  async execute(request: unknown): Promise<VideoCreateTaskResponse> {
    const parsed = CreateVideoContextIRSchema.safeParse(request);

    if (!parsed.success) {
      throw new VideoValidationError(
        parsed.error.issues.map((issue) => issue.message).join('; '),
      );
    }

    return this.videoClient.createContextIRTask(parsed.data);
  }
}
