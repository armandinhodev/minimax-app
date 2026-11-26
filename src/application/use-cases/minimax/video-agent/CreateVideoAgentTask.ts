/**
 * CreateVideoAgentTask use case — create a Video Agent template task.
 */

import {
  CreateVideoAgentTaskSchema,
  type VideoAgentTaskCreatedDTO,
} from '@/application/dto/minimax/video-agent/VideoAgentDTO';
import type { IVideoAgentClient } from '@/domain/interfaces/minimax/video-agent/IVideoAgentClient';

export class CreateVideoAgentTaskValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CreateVideoAgentTaskValidationError';
  }
}

export interface CreateVideoAgentTaskInput {
  templateId: string;
  textInputs?: Array<{ value: string }>;
  mediaInputs?: Array<{ value: string }>;
  callbackUrl?: string;
}

export class CreateVideoAgentTaskUseCase {
  constructor(private readonly videoAgentClient: IVideoAgentClient) {}

  /**
   * @throws CreateVideoAgentTaskValidationError — unknown template or missing inputs
   * @throws Error                         — MiniMax API errors
   */
  async execute(input: CreateVideoAgentTaskInput): Promise<VideoAgentTaskCreatedDTO> {
    const parsed = CreateVideoAgentTaskSchema.safeParse({
      templateId: input.templateId,
      textInputs: input.textInputs ?? [],
      mediaInputs: input.mediaInputs ?? [],
      callbackUrl: input.callbackUrl ?? undefined,
    });

    if (!parsed.success) {
      throw new CreateVideoAgentTaskValidationError(
        parsed.error.issues.map((issue) => issue.message).join('; '),
      );
    }

    return this.videoAgentClient.createTemplateTask(parsed.data);
  }
}
