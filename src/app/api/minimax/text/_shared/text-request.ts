/**
 * Shared helpers for the text routes: the four surfaces accept the same
 * canonical body, so parsing lives in one place.
 */

import type { ChatCompletionRequestInput } from '@/application/dto/minimax/text/TextDTO';
import { ChatCompletionRequestSchema } from '@/application/dto/minimax/text/TextDTO';

export interface ParsedChatRequest {
  data: ChatCompletionRequestInput;
}

/**
 * Parses and validates the canonical chat body.
 * Returns the issues instead of throwing, so each route can answer 400.
 */
export function parseChatRequest(body: unknown): {
  ok: true;
  data: ChatCompletionRequestInput;
} | { ok: false; message: string } {
  const parsed = ChatCompletionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues.map((issue) => issue.message).join('; '),
    };
  }
  return { ok: true, data: parsed.data };
}
