/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CompleteChatUseCase, CompleteChatValidationError } from './CompleteChat';
import type { TextModel } from '@/application/dto/minimax/text/TextDTO';
import type { ITextClient } from '@/domain/interfaces/minimax/text/ITextClient';

const completeMock = vi.fn();
const completeStreamMock = vi.fn();

const client: ITextClient = {
  complete: completeMock,
  completeStream: completeStreamMock,
  listModels: vi.fn(),
  getModel: vi.fn(),
  estimateInputTokens: vi.fn(),
};

describe('CompleteChatUseCase', () => {
  beforeEach(() => {
    completeMock.mockReset();
    completeStreamMock.mockReset();
    completeMock.mockResolvedValue({ id: 'r', model: 'MiniMax-M3.1-Flash', content: 'hola' });
  });

  it('completes against the requested surface with the canonical options', async () => {
    const useCase = new CompleteChatUseCase(client);

    const result = await useCase.execute(
      { messages: [{ role: 'user', content: 'hola' }] },
      'anthropic',
    );

    expect(result.content).toBe('hola');
    expect(completeMock).toHaveBeenCalledWith({
      model: 'MiniMax-M3.1-Flash',
      messages: [{ role: 'user', content: 'hola' }],
    }, 'anthropic');
  });

  it('rejects a request without messages before calling MiniMax', async () => {
    const useCase = new CompleteChatUseCase(client);

    await expect(useCase.execute({ messages: [] }, 'native')).rejects.toBeInstanceOf(
      CompleteChatValidationError,
    );
    expect(completeMock).not.toHaveBeenCalled();
  });

  it('rejects an unknown model before calling MiniMax', async () => {
    const useCase = new CompleteChatUseCase(client);

    await expect(useCase.execute({
      // A model the schema does not know: the cast is the point of the test.
      model: 'gpt-4o' as TextModel,
      messages: [{ role: 'user', content: 'hola' }],
    }, 'native')).rejects.toBeInstanceOf(CompleteChatValidationError);
    expect(completeMock).not.toHaveBeenCalled();
  });

  it('streams through the same validation', async () => {
    const stream = new ReadableStream<Uint8Array>();
    completeStreamMock.mockResolvedValue(stream);
    const useCase = new CompleteChatUseCase(client);

    const result = await useCase.executeStream(
      { messages: [{ role: 'user', content: 'hola' }] },
      'native',
    );

    expect(result).toBe(stream);
    expect(completeStreamMock).toHaveBeenCalledWith({
      model: 'MiniMax-M3.1-Flash',
      messages: [{ role: 'user', content: 'hola' }],
    }, 'native');
  });
});
