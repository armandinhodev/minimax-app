import { describe, expect, it, vi } from 'vitest';

import { GenerateImageUseCase, GenerateImageValidationError } from './GenerateImage';
import type { IImageClient } from '@/domain/interfaces/minimax/image/IImageClient';

function createClient(generateImage: ReturnType<typeof vi.fn>): IImageClient {
  return {
    generateImage,
    enhanceImagePrompt: vi.fn(),
  } as unknown as IImageClient;
}

describe('GenerateImageUseCase', () => {
  it('rejects an invalid request before calling MiniMax', async () => {
    const generateImage = vi.fn();
    const useCase = new GenerateImageUseCase(createClient(generateImage));

    await expect(useCase.execute({ prompt: '   ' } as never)).rejects.toBeInstanceOf(GenerateImageValidationError);
    expect(generateImage).not.toHaveBeenCalled();
  });

  it('rejects legacy image-01 options instead of forwarding them silently', async () => {
    const generateImage = vi.fn();
    const useCase = new GenerateImageUseCase(createClient(generateImage));

    await expect(useCase.execute({ prompt: 'A photo.', seed: 42 } as never)).rejects.toBeInstanceOf(GenerateImageValidationError);
    expect(generateImage).not.toHaveBeenCalled();
  });

  it('forwards the validated H3 request to the image client', async () => {
    const generateImage = vi.fn().mockResolvedValue({
      id: 'req-1',
      imageUrls: ['https://example.com/out-0.jpg'],
      images: [],
      metadata: { successCount: 1, failedCount: 0, totalCount: 1, outputFormat: 'jpeg', requestId: 'req-1', created: null, usage: null },
      expiresAt: null,
    });
    const useCase = new GenerateImageUseCase(createClient(generateImage));

    await useCase.execute({
      model: 'MiniMax-H3-Image',
      prompt: 'A cinematic product photo.',
      n: 2,
      aspectRatio: '16:9',
      area: '2K',
      outputFormat: 'jpeg',
      responseFormat: 'url',
      outputCompression: 95,
      disablePromptEnhanced: false,
      stream: false,
    });

    expect(generateImage).toHaveBeenCalledWith({
      model: 'MiniMax-H3-Image',
      prompt: 'A cinematic product photo.',
      n: 2,
      aspectRatio: '16:9',
      area: '2K',
      outputFormat: 'jpeg',
      responseFormat: 'url',
      outputCompression: 95,
      disablePromptEnhanced: false,
      stream: false,
    });
  });
});
