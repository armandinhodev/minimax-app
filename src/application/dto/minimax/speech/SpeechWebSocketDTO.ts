/**
 * Speech WebSocket DTOs — contrato de `wss://api.minimax.io/ws/v1/t2a_v2`.
 *
 * Fuente oficial (leída 2026-11-26):
 * https://platform.minimax.io/docs/api-reference/speech-t2a-websocket
 *
 * Un Route Handler de App Router no puede hacer upgrade a WebSocket, así que
 * la app usa un relay: el server mantiene la conexión con MiniMax y la
 * reenvía al navegador como Server-Sent Events.
 */

import { z } from 'zod';

/* -------------------------------------------------------------------------- *
 * Vocabularios
 * -------------------------------------------------------------------------- */

export const SPEECH_WEBSOCKET_MODELS = [
  'speech-2.8-hd',
  'speech-2.8-turbo',
  'speech-2.6-hd',
  'speech-2.6-turbo',
  'speech-02-hd',
  'speech-02-turbo',
  'speech-01-hd',
  'speech-01-turbo',
] as const;
export type SpeechWebSocketModel = (typeof SPEECH_WEBSOCKET_MODELS)[number];
export const SpeechWebSocketModelSchema = z.enum(SPEECH_WEBSOCKET_MODELS);

export const SPEECH_WEBSOCKET_FORMATS = [
  'mp3',
  'pcm',
  'flac',
  'wav',
  'pcmu_raw',
  'pcmu_wav',
  'opus',
] as const;
export type SpeechWebSocketFormat = (typeof SPEECH_WEBSOCKET_FORMATS)[number];
export const SpeechWebSocketFormatSchema = z.enum(SPEECH_WEBSOCKET_FORMATS);

export const SPEECH_WEBSOCKET_SAMPLE_RATES = [
  8000, 16000, 22050, 24000, 32000, 44100,
] as const;
export const SpeechWebSocketSampleRateSchema = z.union([
  z.literal(8000),
  z.literal(16000),
  z.literal(22050),
  z.literal(24000),
  z.literal(32000),
  z.literal(44100),
]);

/* -------------------------------------------------------------------------- *
 * Request
 * -------------------------------------------------------------------------- */

export const SpeechWebSocketRequestSchema = z.object({
  /** Texto a sintetizar. Máximo 10.000 caracteres por tramo. */
  text: z.string().min(1, 'The text is required').max(10_000, 'The text must be at most 10,000 characters'),
  voiceId: z.string().min(1, 'voiceId is required'),
  model: SpeechWebSocketModelSchema.default('speech-2.8-hd'),
  speed: z.number().min(0.5).max(2).default(1),
  volume: z.number().gt(0).max(10).default(1),
  pitch: z.number().int().min(-12).max(12).default(0),
  format: SpeechWebSocketFormatSchema.default('mp3'),
  sampleRate: SpeechWebSocketSampleRateSchema.default(32000),
  channel: z.union([z.literal(1), z.literal(2)]).default(1),
  languageBoost: z.string().trim().max(64).optional(),
});

export type SpeechWebSocketRequest = z.output<typeof SpeechWebSocketRequestSchema>;

/* -------------------------------------------------------------------------- *
 * Eventos
 * -------------------------------------------------------------------------- */

/** Eventos que el servidor de MiniMax emite. */
export const SPEECH_WEBSOCKET_EVENTS = [
  'connected_success',
  'task_started',
  'task_continued',
  'task_finished',
  'task_failed',
] as const;
export type SpeechWebSocketEvent = (typeof SPEECH_WEBSOCKET_EVENTS)[number];

/**
 * Evento de la app hacia el navegador.
 *
 * Usa la misma forma que el streaming HTTP de MiniMax — el audio viaja dentro
 * de `data.audio` y en hex — así un solo player reproduce ambos transportes.
 */
export type SpeechStreamChunk =
  | {
    data: { audio: string };
    extra_info?: { usage_characters?: number; word_count?: number };
  }
  | { error: { message: string } };

/** Serializa un chunk de la app al formato SSE. */
export function encodeSpeechStreamChunk(chunk: SpeechStreamChunk): string {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}
