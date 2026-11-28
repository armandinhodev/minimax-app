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

export const T2A_EMOTIONS = [
  'happy',
  'sad',
  'angry',
  'fearful',
  'disgusted',
  'surprised',
  'calm',
  'fluent',
  'whisper',
] as const;

export type T2AEmotion = (typeof T2A_EMOTIONS)[number];

/**
 * Preset emotions the UI may offer for a model.
 * "fluent" and "whisper" are documented only for speech-2.6 models.
 */
export function emotionsForModel(model: string): T2AEmotion[] {
  if (model.includes('2.6')) return [...T2A_EMOTIONS];
  return T2A_EMOTIONS.filter((emotion) => emotion !== 'fluent' && emotion !== 'whisper');
}

/**
 * Inline interjection tags are documented only for Speech 2.8.
 * They are typed into the text, e.g. "Omg(sighs), ...".
 */
export const T2A_INTERJECTION_TAGS = [
  'laughs',
  'chuckle',
  'coughs',
  'clear-throat',
  'groans',
  'breath',
  'pant',
  'inhale',
  'exhale',
  'gasps',
  'sniffs',
  'sighs',
  'snorts',
  'burps',
  'lip-smacking',
  'humming',
  'hissing',
  'emm',
  'sneezes',
] as const;

export function supportsInterjectionTags(model: string): boolean {
  return model.startsWith('speech-2.8');
}

export interface T2APolicy {
  model: string;
  format: AudioFormat;
}

export interface T2ARequest {
  text: string;
  voiceId: string;
  model?: string;
  format?: AudioFormat;
  emotion?: T2AEmotion;
}
