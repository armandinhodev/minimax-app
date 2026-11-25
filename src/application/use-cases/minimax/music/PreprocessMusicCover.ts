import type { MusicCoverPreprocessRequest, MusicCoverPreprocessResponse } from '@/application/dto/minimax/music/MusicDTO';
import { MusicCoverPreprocessSchema } from '@/application/dto/minimax/music/MusicDTO';
import type { IMusicClient } from '@/domain/interfaces/minimax/music/IMusicClient';

export class PreprocessMusicCoverValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PreprocessMusicCoverValidationError';
  }
}

export class PreprocessMusicCoverUseCase {
  constructor(private readonly musicClient: IMusicClient) {}

  async execute(request: MusicCoverPreprocessRequest): Promise<MusicCoverPreprocessResponse> {
    const parsed = MusicCoverPreprocessSchema.safeParse(request);
    if (!parsed.success) {
      throw new PreprocessMusicCoverValidationError(parsed.error.issues.map((issue) => issue.message).join('; '));
    }

    return this.musicClient.preprocessMusicCover(parsed.data);
  }
}
