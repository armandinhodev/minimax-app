/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TranscribeAudioUseCase, TranscribeAudioValidationError } from './TranscribeAudio';
import type { IAsrClient } from '@/domain/interfaces/minimax/asr/IAsrClient';

const transcribeMock = vi.fn();
const transcribeStreamMock = vi.fn();

const client: IAsrClient = {
  transcribe: transcribeMock,
  transcribeStream: transcribeStreamMock,
};

const AUDIO = Buffer.from([1, 2, 3, 4]);

describe('TranscribeAudioUseCase', () => {
  beforeEach(() => {
    transcribeMock.mockReset();
    transcribeStreamMock.mockReset();
    transcribeMock.mockResolvedValue({ text: 'hola', duration: 3.5 });
  });

  it('transcribes a valid audio file with the documented defaults', async () => {
    const useCase = new TranscribeAudioUseCase(client);

    const result = await useCase.execute({
      fileContent: AUDIO,
      fileName: 'sample.wav',
    });

    expect(result).toEqual({ text: 'hola', duration: 3.5 });
    expect(transcribeMock).toHaveBeenCalledWith(AUDIO, 'sample.wav', {
      model: 'asr-1.0',
      responseFormat: 'json',
      timestampLevel: '',
      language: '',
      stream: false,
    });
  });

  it('forwards the requested options', async () => {
    const useCase = new TranscribeAudioUseCase(client);

    await useCase.execute({
      fileContent: AUDIO,
      fileName: 'sample.mp3',
      model: 'asr-1.0',
      responseFormat: 'verbose_json',
      timestampLevel: 'word',
      language: 'en',
    });

    expect(transcribeMock).toHaveBeenCalledWith(AUDIO, 'sample.mp3', {
      model: 'asr-1.0',
      responseFormat: 'verbose_json',
      timestampLevel: 'word',
      language: 'en',
      stream: false,
    });
  });

  it('rejects an unsupported container before calling MiniMax', async () => {
    const useCase = new TranscribeAudioUseCase(client);

    await expect(useCase.execute({
      fileContent: AUDIO,
      fileName: 'notes.txt',
    })).rejects.toBeInstanceOf(TranscribeAudioValidationError);

    expect(transcribeMock).not.toHaveBeenCalled();
  });

  it('rejects a file over the 50MB ceiling before calling MiniMax', async () => {
    const useCase = new TranscribeAudioUseCase(client);

    await expect(useCase.execute({
      fileContent: Buffer.alloc(50 * 1024 * 1024 + 1),
      fileName: 'long.wav',
    })).rejects.toBeInstanceOf(TranscribeAudioValidationError);

    expect(transcribeMock).not.toHaveBeenCalled();
  });

  it('rejects an unknown response format', async () => {
    const useCase = new TranscribeAudioUseCase(client);

    await expect(useCase.execute({
      fileContent: AUDIO,
      fileName: 'sample.wav',
      responseFormat: 'xml',
    })).rejects.toBeInstanceOf(TranscribeAudioValidationError);

    expect(transcribeMock).not.toHaveBeenCalled();
  });

  it('rejects a diarization format combined with streaming', async () => {
    const useCase = new TranscribeAudioUseCase(client);

    await expect(useCase.execute({
      fileContent: AUDIO,
      fileName: 'sample.wav',
      responseFormat: 'srt',
      stream: true,
    })).rejects.toBeInstanceOf(TranscribeAudioValidationError);

    expect(transcribeMock).not.toHaveBeenCalled();
  });

  it('forces streaming on for the streaming execution', async () => {
    const stream = new ReadableStream<Uint8Array>();
    transcribeStreamMock.mockResolvedValue(stream);
    const useCase = new TranscribeAudioUseCase(client);

    const result = await useCase.executeStream({
      fileContent: AUDIO,
      fileName: 'sample.wav',
    });

    expect(result).toBe(stream);
    expect(transcribeStreamMock).toHaveBeenCalledWith(AUDIO, 'sample.wav', {
      model: 'asr-1.0',
      responseFormat: 'json',
      timestampLevel: '',
      language: '',
      stream: true,
    });
    expect(transcribeMock).not.toHaveBeenCalled();
  });
});
