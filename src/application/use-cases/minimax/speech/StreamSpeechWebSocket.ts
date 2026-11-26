/**
 * StreamSpeechWebSocket use case — synthesize speech over the MiniMax
 * WebSocket transport.
 */

import {
  SpeechWebSocketRequestSchema,
} from '@/application/dto/minimax/speech/SpeechWebSocketDTO';
import type { ISpeechWebSocketClient } from '@/domain/interfaces/minimax/speech/ISpeechWebSocketClient';

export class StreamSpeechWebSocketValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StreamSpeechWebSocketValidationError';
  }
}

export interface StreamSpeechWebSocketInput {
  text: string;
  voiceId: string;
  model?: string;
  speed?: number;
  volume?: number;
  pitch?: number;
  format?: string;
  sampleRate?: number;
  channel?: number;
  languageBoost?: string;
}

export class StreamSpeechWebSocketUseCase {
  constructor(private readonly speechWebSocketClient: ISpeechWebSocketClient) {}

  /**
   * @throws StreamSpeechWebSocketValidationError — invalid request
   * @throws Error                          — MiniMax WebSocket errors
   */
  async execute(input: StreamSpeechWebSocketInput): Promise<ReadableStream<Uint8Array>> {
    const parsed = SpeechWebSocketRequestSchema.safeParse({
      text: input.text,
      voiceId: input.voiceId,
      model: input.model ?? undefined,
      speed: input.speed ?? undefined,
      volume: input.volume ?? undefined,
      pitch: input.pitch ?? undefined,
      format: input.format ?? undefined,
      sampleRate: input.sampleRate ?? undefined,
      channel: input.channel ?? undefined,
      languageBoost: input.languageBoost ?? undefined,
    });

    if (!parsed.success) {
      throw new StreamSpeechWebSocketValidationError(
        parsed.error.issues.map((issue) => issue.message).join('; '),
      );
    }

    return this.speechWebSocketClient.synthesize(parsed.data);
  }
}
