import type { ImageContextIRRequest, ImageContextIRResponse } from '@/application/dto/minimax/image/ImageDTO';
import { ImageContextIRRequestSchema } from '@/application/dto/minimax/image/ImageDTO';
import type { IImageClient } from '@/domain/interfaces/minimax/image/IImageClient';

export class EnhanceImagePromptValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnhanceImagePromptValidationError';
  }
}

/**
 * Runs the MiniMax-H3-Image prompt enhancement on its own, without generating
 * images. Used to preview the enhanced prompt before a generation request.
 */
export class EnhanceImagePromptUseCase {
  constructor(private readonly imageClient: IImageClient) {}

  async execute(request: ImageContextIRRequest): Promise<ImageContextIRResponse> {
    const parsed = ImageContextIRRequestSchema.safeParse(request);
    if (!parsed.success) {
      throw new EnhanceImagePromptValidationError(parsed.error.issues.map((issue) => issue.message).join('; '));
    }

    return this.imageClient.enhanceImagePrompt(parsed.data);
  }
}
