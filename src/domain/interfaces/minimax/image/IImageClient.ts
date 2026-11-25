import type { GenerateImageRequest, GenerateImageResponse, ImageContextIRRequest, ImageContextIRResponse } from '@/application/dto/minimax/image/ImageDTO';

/**
 * Port interface for MiniMax image generation operations.
 * Implementations are server-only and must never be bundled for the browser.
 */
export interface IImageClient {
  generateImage(request: GenerateImageRequest): Promise<GenerateImageResponse>;
  enhanceImagePrompt(request: ImageContextIRRequest): Promise<ImageContextIRResponse>;
}
