/**
 * ASR DTOs — contratos de `POST /v1/speech_to_text`.
 *
 * Fuente oficial (leída 2026-11-25):
 * https://platform.minimax.io/docs/api-reference/speech-to-text
 *
 * El endpoint es el único de MiniMax que acepta multipart/form-data con un
 * binario. Este módulo no hace red: solo describe el contrato y valida las
 * combinaciones que el upstream rechaza.
 */

import { z } from 'zod';

/* -------------------------------------------------------------------------- *
 * Vocabularios
 * -------------------------------------------------------------------------- */

export const ASR_MODELS = ['asr-1.0'] as const;
export type AsrModel = (typeof ASR_MODELS)[number];
export const AsrModelSchema = z.enum(ASR_MODELS);

export const ASR_RESPONSE_FORMATS = ['json', 'verbose_json', 'srt', 'vtt'] as const;
export type AsrResponseFormat = (typeof ASR_RESPONSE_FORMATS)[number];
export const AsrResponseFormatSchema = z.enum(ASR_RESPONSE_FORMATS);

export const ASR_TIMESTAMP_LEVELS = ['', 'sentence', 'word'] as const;
export type AsrTimestampLevel = (typeof ASR_TIMESTAMP_LEVELS)[number];
export const AsrTimestampLevelSchema = z.enum(ASR_TIMESTAMP_LEVELS);

/** Formatos que habilitan diarización y alineación forzada. */
export const ASR_DIARIZATION_FORMATS = ['verbose_json', 'srt', 'vtt'] as const;
export type AsrDiarizationFormat = (typeof ASR_DIARIZATION_FORMATS)[number];

/** Formatos que devuelven texto plano de subtítulos en vez de JSON. */
export const ASR_SUBTITLE_FORMATS = ['srt', 'vtt'] as const;
export type AsrSubtitleFormat = (typeof ASR_SUBTITLE_FORMATS)[number];

/**
 * Idiomas soportados por el header `language` (etiquetas BCP-47).
 * Omitirlo o mandarlo vacío habilita el reconocimiento multi-idioma.
 */
export const ASR_LANGUAGES = [
  'zh', 'yue', 'en', 'ja', 'ko', 'th', 'vi', 'id', 'ms', 'fil', 'ar',
  'tr', 'fr', 'de', 'es', 'it', 'pt', 'pl', 'ru', 'uk',
] as const;
export type AsrLanguage = (typeof ASR_LANGUAGES)[number];

/* -------------------------------------------------------------------------- *
 * Límites
 * -------------------------------------------------------------------------- */

const MB = 1024 * 1024;

/** Tope de tamaño del archivo: el upstream responde 413 si se excede. */
export const ASR_MAX_FILE_SIZE_BYTES = 50 * MB;
export const ASR_MAX_FILE_SIZE_MB = 50;

/** Tope de duración del audio: el upstream responde 400 si se excede. */
export const ASR_MAX_AUDIO_SECONDS = 500;

/**
 * Contenedores admitidos. PCM crudo sin contenedor no está soportado.
 */
export const ASR_AUDIO_EXTENSIONS = [
  'wav', 'aiff', 'aif', 'flac', 'alac', 'm4a', 'mp3', 'aac', 'opus', 'ogg',
] as const;

export const ASR_AUDIO_MIME_TYPES = [
  'audio/wav', 'audio/x-wav', 'audio/aiff', 'audio/x-aiff', 'audio/flac',
  'audio/x-flac', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/mpeg',
  'audio/aac', 'audio/opus', 'audio/ogg',
] as const;

/* -------------------------------------------------------------------------- *
 * DTOs de respuesta
 * -------------------------------------------------------------------------- */

/** Segmento con timestamps y hablante. */
export interface AsrSegmentDTO {
  id: number;
  start: number;
  end: number;
  speaker?: string;
  text: string;
}

/**
 * Transcripción completa. `duration` es la duración del audio en segundos:
 * MiniMax factura por esa duración.
 */
export interface AsrTranscriptDTO {
  text: string;
  duration: number;
  nSpeakers?: number;
  segments?: AsrSegmentDTO[];
  traceId?: string;
}

/** Subtítulos en texto plano (srt / vtt). */
export interface AsrSubtitleDTO {
  format: AsrSubtitleFormat;
  content: string;
}

/** Evento incremental del streaming SSE. */
export interface AsrStreamEventDTO {
  index: number;
  delta: string;
  finish: boolean;
  duration?: number;
}

/* -------------------------------------------------------------------------- *
 * Request
 * -------------------------------------------------------------------------- */

/**
 * Opciones de una transcripción, sin el binario.
 */
export interface AsrTranscriptionOptions {
  model: AsrModel;
  responseFormat: AsrResponseFormat;
  timestampLevel: AsrTimestampLevel;
  language: string;
  stream: boolean;
}

export const AsrTranscriptionOptionsSchema = z
  .object({
    model: AsrModelSchema.default('asr-1.0'),
    responseFormat: AsrResponseFormatSchema.default('json'),
    timestampLevel: AsrTimestampLevelSchema.default(''),
    language: z.string().trim().max(16).default(''),
    stream: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    // La doc es explícita: verbose_json / srt / vtt habilitan diarización y
    // alineación forzada, y no se pueden combinar con stream=true.
    if (
      value.stream
      && (ASR_DIARIZATION_FORMATS as readonly string[]).includes(value.responseFormat)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['responseFormat'],
        message:
          'Speaker diarization formats (verbose_json, srt, vtt) cannot be combined with streaming',
      });
    }
  });

export type AsrTranscriptionOptionsInput = z.input<typeof AsrTranscriptionOptionsSchema>;
export type AsrTranscriptionOptionsParsed = z.output<typeof AsrTranscriptionOptionsSchema>;

/**
 * Extrae la extensión de un nombre de archivo, en minúsculas.
 */
export function getAudioExtension(fileName: string): string {
  const index = fileName.lastIndexOf('.');
  if (index === -1 || index === fileName.length - 1) return '';
  return fileName.slice(index + 1).toLowerCase();
}

/**
 * Valida que el archivo sea un contenedor de audio admitido y que no exceda
 * el tope de tamaño. No inspecciona el contenido: el server nunca decodifica
 * audio, solo lo reenvía.
 *
 * Devuelve el mensaje de error, o null cuando el archivo es aceptable.
 */
export function validateAudioFile(fileName: string, sizeBytes: number): string | null {
  if (sizeBytes <= 0) {
    return 'The audio file is empty';
  }
  if (sizeBytes > ASR_MAX_FILE_SIZE_BYTES) {
    return `Audio must be ${ASR_MAX_FILE_SIZE_MB}MB or smaller`;
  }

  const extension = getAudioExtension(fileName);
  if (!(ASR_AUDIO_EXTENSIONS as readonly string[]).includes(extension)) {
    return `Unsupported audio format. Use one of: ${ASR_AUDIO_EXTENSIONS.join(', ')}`;
  }

  return null;
}

/**
 * Devuelve el Content-Type del subtítulo según el formato pedido.
 */
export function getSubtitleContentType(format: AsrSubtitleFormat): string {
  return format === 'vtt' ? 'text/vtt' : 'text/plain';
}
