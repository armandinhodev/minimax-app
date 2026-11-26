/**
 * QueryVideoAgentTask use case — read the status of a Video Agent task.
 */

import type { VideoAgentTaskDTO } from '@/application/dto/minimax/video-agent/VideoAgentDTO';
import type { IVideoAgentClient } from '@/domain/interfaces/minimax/video-agent/IVideoAgentClient';

export class QueryVideoAgentTaskValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueryVideoAgentTaskValidationError';
  }
}

/** MiniMax task ids are opaque numeric strings. */
const TASK_ID_PATTERN = /^\d{1,19}$/;

export class QueryVideoAgentTaskUseCase {
  constructor(private readonly videoAgentClient: IVideoAgentClient) {}

  /**
   * @throws QueryVideoAgentTaskValidationError — malformed task id
   * @throws Error                        — MiniMax API errors
   */
  async execute(taskId: string): Promise<VideoAgentTaskDTO> {
    const trimmed = taskId.trim();
    if (!TASK_ID_PATTERN.test(trimmed)) {
      throw new QueryVideoAgentTaskValidationError('The task ID is not a valid MiniMax task ID');
    }

    return this.videoAgentClient.queryTemplateTask(trimmed);
  }
}
