/**
 * EstimateInputTokens use case — estimate the input tokens of a conversation
 * without invoking the model (POST /v1/responses/input_tokens).
 */

import type {
  ChatCompletionOptions,
  InputTokensEstimate,
} from '@/application/dto/minimax/text/TextDTO';
import { ChatCompletionRequestSchema } from '@/application/dto/minimax/text/TextDTO';
import type { ITextClient } from '@/domain/interfaces/minimax/text/ITextClient';

export class EstimateInputTokensValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EstimateInputTokensValidationError';
  }
}

export interface EstimateInputTokensInput extends Partial<ChatCompletionOptions> {
  messages: ChatCompletionOptions['messages'];
}

export class EstimateInputTokensUseCase {
  constructor(private readonly textClient: ITextClient) {}

  /**
   * @throws EstimateInputTokensValidationError — invalid request
   * @throws Error                         — MiniMax API errors
   */
  async execute(input: EstimateInputTokensInput): Promise<InputTokensEstimate> {
    const parsed = ChatCompletionRequestSchema.safeParse({
      model: input.model ?? undefined,
      system: input.system ?? undefined,
      messages: input.messages,
      maxCompletionTokens: input.maxCompletionTokens ?? undefined,
      temperature: input.temperature ?? undefined,
      topP: input.topP ?? undefined,
      tools: input.tools ?? undefined,
      toolChoice: input.toolChoice ?? undefined,
      maskSensitiveInfo: input.maskSensitiveInfo ?? undefined,
    });

    if (!parsed.success) {
      throw new EstimateInputTokensValidationError(
        parsed.error.issues.map((issue) => issue.message).join('; '),
      );
    }

    return this.textClient.estimateInputTokens(parsed.data);
  }
}
