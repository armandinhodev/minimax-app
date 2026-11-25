import type { GenerateLyricsRequest, GenerateLyricsResponse } from '@/application/dto/minimax/music/MusicDTO';
import { GenerateLyricsSchema } from '@/application/dto/minimax/music/MusicDTO';
import type { IMusicClient } from '@/domain/interfaces/minimax/music/IMusicClient';

export class GenerateLyricsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GenerateLyricsValidationError';
  }
}

export class GenerateLyricsUseCase {
  constructor(private readonly musicClient: IMusicClient) {}

  async execute(request: GenerateLyricsRequest): Promise<GenerateLyricsResponse> {
    const parsed = GenerateLyricsSchema.safeParse(request);
    if (!parsed.success) {
      throw new GenerateLyricsValidationError(parsed.error.issues.map((issue) => issue.message).join('; '));
    }

    return this.musicClient.generateLyrics(parsed.data);
  }
}
