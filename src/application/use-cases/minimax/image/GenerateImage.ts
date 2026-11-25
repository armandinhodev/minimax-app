import type { GenerateImageRequest, GenerateImageResponse } from '@/application/dto/minimax/image/ImageDTO';
import { GenerateImageSchema } from '@/application/dto/minimax/image/ImageDTO';
import type { IImageClient } from '@/domain/interfaces/minimax/image/IImageClient';

export class GenerateImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GenerateImageValidationError';
  }
}

export class GenerateImageUseCase {
  constructor(private readonly imageClient: IImageClient) {}

  async execute(request: GenerateImageRequest): Promise<GenerateImageResponse> {
    const parsed = GenerateImageSchema.safeParse(request);
    if (!parsed.success) {
      throw new GenerateImageValidationError(parsed.error.issues.map((issue) => issue.message).join('; '));
    }

    return this.imageClient.generateImage(parsed.data);
  }
}
