/**
 * MiniMax WebSocket text-to-speech client.
 * @server-only — this module must never be bundled for the browser.
 *
 * The browser cannot open the connection: MiniMax authenticates the
 * WebSocket with the API key, and that key must never leave the server.
 * So the server holds the socket and relays the audio to the browser as
 * Server-Sent Events.
 *
 * Protocol (https://platform.minimax.io/docs/api-reference/speech-t2a-websocket):
 *   server -> connected_success
 *   client -> task_start   { model, voice_setting, audio_setting }
 *   server -> task_started
 *   client -> task_continue { text }
 *   server -> task_continued { data: { audio: hex }, is_final, extra_info }
 *   server -> task_finished | task_failed
 */

import 'server-only';

import {
  encodeSpeechStreamChunk,
  type SpeechStreamChunk,
  type SpeechWebSocketRequest,
} from '@/application/dto/minimax/speech/SpeechWebSocketDTO';
import type { ISpeechWebSocketClient } from '@/domain/interfaces/minimax/speech/ISpeechWebSocketClient';

import { buildAuthHeader, requireMiniMaxApiKey } from '../MiniMaxConfig';

const WS_URL = 'wss://api.minimax.io/ws/v1/t2a_v2';

/** MiniMax closes the socket after 120 seconds without traffic. */
const IDLE_TIMEOUT_MS = 120_000;
const HANDSHAKE_TIMEOUT_MS = 30_000;

export class MiniMaxSpeechWebSocketError extends Error {
  constructor(message: string, readonly code = 0) {
    super(message);
    this.name = 'MiniMaxSpeechWebSocketError';
  }
}

/**
 * Buffers the incoming frames so the handshake and the stream can await
 * them independently.
 */
class MessageQueue {
  private readonly buffered: string[] = [];
  private readonly waiters: Array<(value: string | null) => void> = [];
  private closed = false;

  push(message: string): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(message);
      return;
    }
    this.buffered.push(message);
  }

  close(): void {
    this.closed = true;
    while (this.waiters.length > 0) {
      this.waiters.shift()?.(null);
    }
  }

  next(timeoutMs: number): Promise<string | null> {
    if (this.buffered.length > 0) {
      return Promise.resolve(this.buffered.shift() ?? null);
    }
    if (this.closed) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const index = this.waiters.findIndex((waiter) => waiter === onMessage);
        if (index !== -1) this.waiters.splice(index, 1);
        resolve(null);
      }, timeoutMs);

      const onMessage = (value: string | null) => {
        clearTimeout(timer);
        resolve(value);
      };
      this.waiters.push(onMessage);
    });
  }
}

function parseEvent(message: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(message) as unknown;
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function readErrorMessage(payload: Record<string, unknown>): string {
  const baseResp = payload.base_resp as Record<string, unknown> | undefined;
  const statusMsg = typeof baseResp?.status_msg === 'string' ? baseResp.status_msg : '';
  return statusMsg.length > 0 ? statusMsg : 'MiniMax rejected the WebSocket task';
}

export class SpeechWebSocketClient implements ISpeechWebSocketClient {
  async synthesize(request: SpeechWebSocketRequest): Promise<ReadableStream<Uint8Array>> {
    const apiKey = requireMiniMaxApiKey();
    const queue = new MessageQueue();

    /**
     * Node's WebSocket (undici) accepts a `headers` option, which is how
     * MiniMax authenticates the socket. The DOM typings only declare
     * `protocols`, so the option is cast: the runtime behaviour is what
     * matters here, and it is verified by the client tests.
     */
    const socketOptions = {
      headers: { Authorization: buildAuthHeader(apiKey) },
    } as unknown as string[];

    const socket = new WebSocket(WS_URL, socketOptions);

    socket.addEventListener('message', (event) => {
      queue.push(typeof event.data === 'string' ? event.data : String(event.data));
    });
    socket.addEventListener('close', () => queue.close());
    socket.addEventListener('error', () => queue.close());

    await this.waitForOpen(socket);

    const connected = parseEvent((await queue.next(HANDSHAKE_TIMEOUT_MS)) ?? '{}');
    if (connected.event !== 'connected_success') {
      socket.close();
      throw new MiniMaxSpeechWebSocketError(readErrorMessage(connected));
    }

    socket.send(JSON.stringify({
      event: 'task_start',
      model: request.model,
      voice_setting: {
        voice_id: request.voiceId,
        speed: request.speed,
        vol: request.volume,
        pitch: request.pitch,
        ...(request.languageBoost ? { language_boost: request.languageBoost } : {}),
      },
      audio_setting: {
        sample_rate: request.sampleRate,
        format: request.format,
        channel: request.channel,
      },
    }));

    const started = parseEvent((await queue.next(HANDSHAKE_TIMEOUT_MS)) ?? '{}');
    if (started.event !== 'task_started') {
      socket.close();
      throw new MiniMaxSpeechWebSocketError(readErrorMessage(started));
    }

    socket.send(JSON.stringify({ event: 'task_continue', text: request.text }));

    const encoder = new TextEncoder();

    return new ReadableStream<Uint8Array>({
      start: (controller) => {
        const pump = async () => {
          try {
            for (;;) {
              const message = await queue.next(IDLE_TIMEOUT_MS);
              if (message === null) {
                socket.close();
                controller.enqueue(encoder.encode(
                  encodeSpeechStreamChunk({
                    error: { message: 'The MiniMax stream ended unexpectedly' },
                  }),
                ));
                controller.close();
                return;
              }

              const payload = parseEvent(message);
              const event = typeof payload.event === 'string' ? payload.event : '';

              if (event === 'task_failed') {
                socket.close();
                controller.enqueue(encoder.encode(
                  encodeSpeechStreamChunk({ error: { message: readErrorMessage(payload) } }),
                ));
                controller.close();
                return;
              }

              if (event === 'task_finished') {
                socket.close();
                controller.close();
                return;
              }

              const data = payload.data as Record<string, unknown> | undefined;
              const audioHex = typeof data?.audio === 'string' ? data.audio : '';
              if (!audioHex) continue;

              const extraInfo = payload.extra_info as Record<string, unknown> | undefined;
              const chunk: SpeechStreamChunk = {
                data: { audio: audioHex },
                ...(typeof extraInfo?.usage_characters === 'number'
                  || typeof extraInfo?.word_count === 'number'
                  ? {
                    extra_info: {
                      ...(typeof extraInfo?.usage_characters === 'number'
                        ? { usage_characters: extraInfo.usage_characters }
                        : {}),
                      ...(typeof extraInfo?.word_count === 'number'
                        ? { word_count: extraInfo.word_count }
                        : {}),
                    },
                  }
                  : {}),
              };
              controller.enqueue(encoder.encode(encodeSpeechStreamChunk(chunk)));
            }
          } catch (error) {
            controller.error(error);
          }
        };
        void pump();
      },
      cancel: () => {
        socket.close();
      },
    });
  }

  private waitForOpen(socket: WebSocket): Promise<void> {
    if (socket.readyState === WebSocket.OPEN) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.close();
        reject(new MiniMaxSpeechWebSocketError('The MiniMax WebSocket did not open in time'));
      }, HANDSHAKE_TIMEOUT_MS);

      socket.addEventListener('open', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });

      socket.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new MiniMaxSpeechWebSocketError('Could not open the MiniMax WebSocket'));
      }, { once: true });

      socket.addEventListener('close', () => {
        clearTimeout(timer);
        reject(new MiniMaxSpeechWebSocketError('The MiniMax WebSocket closed before the handshake'));
      }, { once: true });
    });
  }
}
