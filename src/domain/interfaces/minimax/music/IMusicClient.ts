import type { GenerateLyricsRequest, GenerateLyricsResponse, GenerateMusicRequest, GenerateMusicResponse, MusicCoverPreprocessRequest, MusicCoverPreprocessResponse } from '@/application/dto/minimax/music/MusicDTO';

/**
 * Port interface for MiniMax music generation operations.
 * Implementations are server-only and must never be bundled for the browser.
 */
export interface IMusicClient {
  generateMusic(request: GenerateMusicRequest): Promise<GenerateMusicResponse>;
  generateLyrics(request: GenerateLyricsRequest): Promise<GenerateLyricsResponse>;
  preprocessMusicCover(request: MusicCoverPreprocessRequest): Promise<MusicCoverPreprocessResponse>;
}
