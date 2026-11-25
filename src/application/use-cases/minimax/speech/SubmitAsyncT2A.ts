/**
 * SubmitAsyncT2A use case — submit a long-text T2A task for async processing.
 * Returns a task_id that is used to poll for completion.
 */

import type { ISpeechClient } from '@/domain/interfaces/minimax/speech/ISpeechClient';
import { SubmitAsyncT2ASchema } from '@/application/dto/minimax/speech/SpeechDTO';
import type { T2ATask } from '@/domain/entities/T2ATask';
import type { T2ARequest } from '@/domain/value-objects/T2APolicy';

export class SubmitAsyncT2AValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubmitAsyncT2AValidationError';
  }
}

export class SubmitAsyncT2AUseCase {
  constructor(private readonly speechClient: ISpeechClient) {}

  /**
   * Submit an async T2A task.
   *
   * @throws SubmitAsyncT2AValidationError — invalid input
   * @throws Error                         — MiniMax API errors
   */
  async execute(request: T2ARequest): Promise<T2ATask> {
    const parsed = SubmitAsyncT2ASchema.safeParse(request);
    if (!parsed.success) {
      throw new SubmitAsyncT2AValidationError(
        parsed.error.issues.map((e: { message: string }) => e.message).join('; ')
      );
    }

    return this.speechClient.submitAsync(parsed.data);
  }
}
