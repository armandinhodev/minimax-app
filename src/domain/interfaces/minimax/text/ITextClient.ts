/**
 * Port interface for MiniMax Text (LLM) operations.
 * Implementations are server-only and must never be bundled for the browser.
 *
 * Surfaces:
 * - native:   POST /v1/text/chatcompletion_v2
 * - openai:   POST /v1/chat/completions
 * - anthropic:POST /anthropic/v1/messages
 * - responses:POST /v1/responses
 */
import type {
  ChatCompletionOptions,
  ChatCompletionResult,
  InputTokensEstimate,
  TextModelDTO,
  TextSurface,
} from '@/application/dto/minimax/text/TextDTO';

export interface ITextClient {
  /** Run a completion against the requested surface. */
  complete(request: ChatCompletionOptions, surface: TextSurface): Promise<ChatCompletionResult>;

  /** Run a completion and stream the upstream SSE bytes verbatim. */
  completeStream(
    request: ChatCompletionOptions,
    surface: TextSurface,
  ): Promise<ReadableStream<Uint8Array>>;

  /** List the models available to the account. */
  listModels(): Promise<TextModelDTO[]>;

  /** Retrieve one model by id. */
  getModel(modelId: string): Promise<TextModelDTO>;

  /** Estimate the input tokens of a conversation. */
  estimateInputTokens(request: ChatCompletionOptions): Promise<InputTokensEstimate>;
}
