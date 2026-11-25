import type { GenerateMusicRequest, GenerateMusicResponse } from '@/application/dto/minimax/music/MusicDTO';
import { GenerateMusicSchema } from '@/application/dto/minimax/music/MusicDTO';
import type { IMusicClient } from '@/domain/interfaces/minimax/music/IMusicClient';

export class GenerateMusicValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GenerateMusicValidationError';
  }
}

export class GenerateMusicUseCase {
  constructor(private readonly musicClient: IMusicClient) {}

  async execute(request: GenerateMusicRequest): Promise<GenerateMusicResponse> {
    const parsed = GenerateMusicSchema.safeParse(request);
    if (!parsed.success) {
      throw new GenerateMusicValidationError(parsed.error.issues.map((issue) => issue.message).join('; '));
    }

    return this.musicClient.generateMusic(parsed.data);
  }
}
