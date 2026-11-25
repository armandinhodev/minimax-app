/**
 * Port interface for MiniMax Speech-to-Text (ASR) operations.
 * Implementations are server-only and must never be bundled for the browser.
 *
 * https://platform.minimax.io/docs/api-reference/speech-to-text
 */
import type {
  AsrStreamEventDTO,
  AsrSubtitleDTO,
  AsrTranscriptDTO,
  AsrTranscriptionOptions,
} from '@/application/dto/minimax/asr/AsrDTO';

export interface IAsrClient {
  /**
   * Transcribe an audio file. Returns a JSON transcript for `json` /
   * `verbose_json`, or raw subtitles for `srt` / `vtt`.
   */
  transcribe(
    fileContent: Buffer,
    fileName: string,
    options: AsrTranscriptionOptions,
  ): Promise<AsrTranscriptDTO | AsrSubtitleDTO>;

  /**
   * Transcribe an audio file, streaming incremental events.
   * The returned stream carries the raw SSE bytes; the caller decodes them.
   */
  transcribeStream(
    fileContent: Buffer,
    fileName: string,
    options: AsrTranscriptionOptions,
  ): Promise<ReadableStream<Uint8Array>>;
}

export type { AsrStreamEventDTO, AsrSubtitleDTO, AsrTranscriptDTO, AsrTranscriptionOptions };
