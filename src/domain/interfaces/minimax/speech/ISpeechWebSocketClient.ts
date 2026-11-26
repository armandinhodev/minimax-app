/**
 * Port interface for the MiniMax WebSocket text-to-speech transport.
 * Implementations are server-only and must never be bundled for the browser.
 *
 * The browser cannot hold a WebSocket to MiniMax: the API key must never
 * reach it. The server holds the connection and relays the audio.
 */
import type {
  SpeechStreamChunk,
  SpeechWebSocketRequest,
} from '@/application/dto/minimax/speech/SpeechWebSocketDTO';

export interface ISpeechWebSocketClient {
  /**
   * Synthesize the text and stream the normalized chunks.
   * The returned stream carries SSE-encoded bytes for the browser.
   */
  synthesize(request: SpeechWebSocketRequest): Promise<ReadableStream<Uint8Array>>;
}

export type { SpeechStreamChunk, SpeechWebSocketRequest };
