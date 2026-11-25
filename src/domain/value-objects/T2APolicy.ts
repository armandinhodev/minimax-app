import type { AudioFormat } from './AudioFormat';

export const DEFAULT_T2A_MODEL = 'speech-2.8-hd' as const;
export const DEFAULT_T2A_FORMAT: AudioFormat = 'mp3';

/**
 * Maximum characters accepted by the synchronous T2A endpoint (/v1/t2a_v2).
 * https://platform.minimax.io/docs/api-reference/speech-t2a-http
 */
export const MAX_SYNC_T2A_TEXT_LENGTH = 10_000;

/**
 * Maximum characters accepted by the asynchronous T2A endpoint
 * (/v1/t2a_async_v2) when the text is sent inline. The 1,000,000 character
 * ceiling documented by MiniMax only applies to zip file tasks, which the app
 * does not submit.
 * https://platform.minimax.io/docs/api-reference/speech-t2a-async-create
 */
export const MAX_ASYNC_T2A_TEXT_LENGTH = 100_000;

export interface T2APolicy {
  model: string;
  format: AudioFormat;
}

export interface T2ARequest {
  text: string;
  voiceId: string;
  model?: string;
  format?: AudioFormat;
}
