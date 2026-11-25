/**
 * TranscribeAudio use case — transcribe an audio file with MiniMax ASR.
 *
 * The audio binary never leaves the server: it is validated here and handed
 * to the client as a buffer.
 */

import type {
  AsrSubtitleDTO,
  AsrTranscriptDTO,
  AsrTranscriptionOptionsParsed,
} from '@/application/dto/minimax/asr/AsrDTO';
import {
  AsrTranscriptionOptionsSchema,
  validateAudioFile,
} from '@/application/dto/minimax/asr/AsrDTO';
import type { IAsrClient } from '@/domain/interfaces/minimax/asr/IAsrClient';

export class TranscribeAudioValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranscribeAudioValidationError';
  }
}

export interface TranscribeAudioInput {
  fileContent: Buffer;
  fileName: string;
  model?: string;
  responseFormat?: string;
  timestampLevel?: string;
  language?: string;
  stream?: boolean;
}

export class TranscribeAudioUseCase {
  constructor(private readonly asrClient: IAsrClient) {}

  /**
   * Validates the input and resolves the options the client expects.
   *
   * @throws TranscribeAudioValidationError — invalid file or unsupported option combination
   */
  private prepare(input: TranscribeAudioInput): {
    fileContent: Buffer;
    fileName: string;
    options: AsrTranscriptionOptionsParsed;
  } {
    const fileError = validateAudioFile(input.fileName, input.fileContent.byteLength);
    if (fileError) {
      throw new TranscribeAudioValidationError(fileError);
    }

    const parsed = AsrTranscriptionOptionsSchema.safeParse({
      model: input.model ?? undefined,
      responseFormat: input.responseFormat ?? undefined,
      timestampLevel: input.timestampLevel ?? undefined,
      language: input.language ?? undefined,
      stream: input.stream ?? false,
    });

    if (!parsed.success) {
      throw new TranscribeAudioValidationError(
        parsed.error.issues.map((issue) => issue.message).join('; '),
      );
    }

    return { fileContent: input.fileContent, fileName: input.fileName, options: parsed.data };
  }

  /**
   * Execute a transcription.
   *
   * @throws TranscribeAudioValidationError — invalid file or unsupported option combination
   * @throws Error                          — MiniMax API errors
   */
  async execute(
    input: TranscribeAudioInput,
  ): Promise<AsrTranscriptDTO | AsrSubtitleDTO> {
    const { fileContent, fileName, options } = this.prepare(input);
    return this.asrClient.transcribe(fileContent, fileName, options);
  }

  /**
   * Execute a streaming transcription. The returned stream carries the raw
   * SSE bytes coming from MiniMax.
   *
   * @throws TranscribeAudioValidationError — invalid file or unsupported option combination
   * @throws Error                          — MiniMax API errors
   */
  async executeStream(input: TranscribeAudioInput): Promise<ReadableStream<Uint8Array>> {
    const { fileContent, fileName, options } = this.prepare(input);
    return this.asrClient.transcribeStream(fileContent, fileName, {
      ...options,
      stream: true,
    });
  }
}
