import type {
  GenerateImageRequest,
  GenerateImageResponse,
  ImageContextIRRequest,
  ImageContextIRResponse,
} from '@/application/dto/ImageDTO';

/**
 * Port interface for MiniMax image generation operations.
 * Implementations are server-only and must never be bundled for the browser.
 */
export interface IMiniMaxImageClient {
  generateImage(request: GenerateImageRequest): Promise<GenerateImageResponse>;
  enhanceImagePrompt(request: ImageContextIRRequest): Promise<ImageContextIRResponse>;
}
