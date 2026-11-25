import { describe, expect, it, vi } from 'vitest';

import { EnhanceImagePromptUseCase, EnhanceImagePromptValidationError } from './EnhanceImagePrompt';
import type { IImageClient } from '@/domain/interfaces/minimax/image/IImageClient';

function createClient(enhanceImagePrompt: ReturnType<typeof vi.fn>): IImageClient {
  return {
    generateImage: vi.fn(),
    enhanceImagePrompt,
  } as unknown as IImageClient;
}

describe('EnhanceImagePromptUseCase', () => {
  it('rejects an invalid request before calling MiniMax', async () => {
    const enhanceImagePrompt = vi.fn();
    const useCase = new EnhanceImagePromptUseCase(createClient(enhanceImagePrompt));

    await expect(useCase.execute({ prompt: '' } as never)).rejects.toBeInstanceOf(EnhanceImagePromptValidationError);
    expect(enhanceImagePrompt).not.toHaveBeenCalled();
  });

  it('rejects the highspeed model, which the context IR endpoint does not support', async () => {
    const enhanceImagePrompt = vi.fn();
    const useCase = new EnhanceImagePromptUseCase(createClient(enhanceImagePrompt));

    await expect(useCase.execute({
      model: 'MiniMax-H3-Image-Highspeed',
      prompt: 'A photo.',
    } as never)).rejects.toBeInstanceOf(EnhanceImagePromptValidationError);
    expect(enhanceImagePrompt).not.toHaveBeenCalled();
  });

  it('forwards the validated request to the image client', async () => {
    const enhanceImagePrompt = vi.fn().mockResolvedValue({
      revisedPrompt: 'An enhanced prompt.',
      aspectRatio: '3:2',
      requestId: 'req-ir',
      created: 1,
      usage: null,
    });
    const useCase = new EnhanceImagePromptUseCase(createClient(enhanceImagePrompt));

    await useCase.execute({ model: 'MiniMax-H3-Image', prompt: 'A cat on a windowsill.' });

    expect(enhanceImagePrompt).toHaveBeenCalledWith({
      model: 'MiniMax-H3-Image',
      prompt: 'A cat on a windowsill.',
    });
  });
});
