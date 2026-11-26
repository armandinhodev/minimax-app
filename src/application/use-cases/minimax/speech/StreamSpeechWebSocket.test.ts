/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  StreamSpeechWebSocketUseCase,
  StreamSpeechWebSocketValidationError,
} from './StreamSpeechWebSocket';
import type { ISpeechWebSocketClient } from '@/domain/interfaces/minimax/speech/ISpeechWebSocketClient';

const synthesizeMock = vi.fn();

const client: ISpeechWebSocketClient = {
  synthesize: synthesizeMock,
};

describe('StreamSpeechWebSocketUseCase', () => {
  beforeEach(() => {
    synthesizeMock.mockReset();
    synthesizeMock.mockResolvedValue(new ReadableStream<Uint8Array>());
  });

  it('applies the documented defaults', async () => {
    const useCase = new StreamSpeechWebSocketUseCase(client);

    await useCase.execute({ text: 'hola', voiceId: 'English_radiant_girl' });

    expect(synthesizeMock).toHaveBeenCalledWith({
      text: 'hola',
      voiceId: 'English_radiant_girl',
      model: 'speech-2.8-hd',
      speed: 1,
      volume: 1,
      pitch: 0,
      format: 'mp3',
      sampleRate: 32000,
      channel: 1,
      languageBoost: undefined,
    });
  });

  it('forwards the requested options', async () => {
    const useCase = new StreamSpeechWebSocketUseCase(client);

    await useCase.execute({
      text: 'hola',
      voiceId: 'voice-1',
      model: 'speech-02-turbo',
      speed: 1.5,
      volume: 2,
      pitch: -3,
      format: 'opus',
      sampleRate: 24000,
      channel: 2,
      languageBoost: 'Spanish',
    });

    expect(synthesizeMock).toHaveBeenCalledWith(expect.objectContaining({
      model: 'speech-02-turbo',
      speed: 1.5,
      pitch: -3,
      format: 'opus',
      sampleRate: 24000,
      channel: 2,
      languageBoost: 'Spanish',
    }));
  });

  it('rejects an empty text before opening the socket', async () => {
    const useCase = new StreamSpeechWebSocketUseCase(client);

    await expect(useCase.execute({ text: '', voiceId: 'voice-1' })).rejects.toBeInstanceOf(
      StreamSpeechWebSocketValidationError,
    );
    expect(synthesizeMock).not.toHaveBeenCalled();
  });

  it('rejects text over the 10,000 character limit', async () => {
    const useCase = new StreamSpeechWebSocketUseCase(client);

    await expect(useCase.execute({ text: 'a'.repeat(10_001), voiceId: 'voice-1' })).rejects.toBeInstanceOf(
      StreamSpeechWebSocketValidationError,
    );
    expect(synthesizeMock).not.toHaveBeenCalled();
  });

  it('rejects an unknown model before opening the socket', async () => {
    const useCase = new StreamSpeechWebSocketUseCase(client);

    await expect(useCase.execute({
      text: 'hola',
      voiceId: 'voice-1',
      model: 'speech-9',
    })).rejects.toBeInstanceOf(StreamSpeechWebSocketValidationError);
    expect(synthesizeMock).not.toHaveBeenCalled();
  });
});
