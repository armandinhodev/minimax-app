/**
 * CompleteChat use case — run a chat completion against a MiniMax text
 * surface and normalize the result.
 */

import type {
  ChatCompletionResult,
  ChatCompletionOptions,
  TextSurface,
} from '@/application/dto/minimax/text/TextDTO';
import { ChatCompletionRequestSchema } from '@/application/dto/minimax/text/TextDTO';
import type { ITextClient } from '@/domain/interfaces/minimax/text/ITextClient';

export class CompleteChatValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompleteChatValidationError';
  }
}

export interface CompleteChatInput extends Partial<ChatCompletionOptions> {
  messages: ChatCompletionOptions['messages'];
}

export class CompleteChatUseCase {
  constructor(private readonly textClient: ITextClient) {}

  /**
   * Validate the request and resolve the canonical options.
   *
   * @throws CompleteChatValidationError — invalid request
   */
  private prepare(input: CompleteChatInput): ChatCompletionOptions {
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
      throw new CompleteChatValidationError(
        parsed.error.issues.map((issue) => issue.message).join('; '),
      );
    }

    return parsed.data;
  }

  /**
   * @throws CompleteChatValidationError — invalid request
   * @throws Error                   — MiniMax API errors
   */
  async execute(input: CompleteChatInput, surface: TextSurface): Promise<ChatCompletionResult> {
    return this.textClient.complete(this.prepare(input), surface);
  }

  /**
   * @throws CompleteChatValidationError — invalid request
   * @throws Error                   — MiniMax API errors
   */
  async executeStream(
    input: CompleteChatInput,
    surface: TextSurface,
  ): Promise<ReadableStream<Uint8Array>> {
    return this.textClient.completeStream(this.prepare(input), surface);
  }
}
