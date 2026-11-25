import { describe, expect, it } from 'vitest';

import { GenerateLyricsSchema, GenerateMusicSchema, MUSIC_AVAILABILITY_NOTICE, MusicCoverPreprocessSchema, MusicModelSchema, MusicOutputFormatSchema } from './MusicDTO';

describe('MusicModelSchema', () => {
  it('keeps only the paid models MiniMax still serves', () => {
    expect(MusicModelSchema.options).toEqual(['music-3.0', 'music-cover']);
  });

  it('rejects the discontinued free music models', () => {
    expect(MusicModelSchema.safeParse('music-3.0-free').success).toBe(false);
    expect(MusicModelSchema.safeParse('music-2.6-free').success).toBe(false);
    expect(MusicModelSchema.safeParse('music-cover-free').success).toBe(false);
  });

  it('publishes an availability notice for existing paying accounts', () => {
    expect(MUSIC_AVAILABILITY_NOTICE).toContain('existing paying accounts');
    expect(MUSIC_AVAILABILITY_NOTICE.toLowerCase()).toContain('discontinued');
  });
});

describe('GenerateMusicSchema', () => {
  it('accepts the hex output format the app stores locally', () => {
    expect(MusicOutputFormatSchema.safeParse('hex').success).toBe(true);
    const result = GenerateMusicSchema.safeParse({
      prompt: 'Glossy synth-pop.',
      lyrics: '[Chorus]\nRise again',
      outputFormat: 'hex',
    });

    expect(result.success).toBe(true);
  });

  it('rejects the url output format so a URL never reaches the hex decoder', () => {
    expect(MusicOutputFormatSchema.safeParse('url').success).toBe(false);
    expect(GenerateMusicSchema.safeParse({
      prompt: 'Glossy synth-pop.',
      lyrics: '[Chorus]\nRise again',
      outputFormat: 'url',
    }).success).toBe(false);
  });

  it('allows instrumental music with a prompt and no lyrics', () => {
    const result = GenerateMusicSchema.safeParse({
      prompt: 'Instrumental cinematic piano.',
      instrumental: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.instrumental).toBe(true);
    }
  });

  it('still requires lyrics for vocal music', () => {
    expect(GenerateMusicSchema.safeParse({ prompt: 'Glossy synth-pop.' }).success).toBe(false);
  });

  it('keeps the documented cover generation rules', () => {
    expect(GenerateMusicSchema.safeParse({
      model: 'music-cover',
      coverFeatureId: 'cover-feature-1',
      prompt: 'Acoustic folk cover with warm vocals.',
    }).success).toBe(true);

    expect(GenerateMusicSchema.safeParse({
      model: 'music-cover',
      prompt: 'Acoustic folk cover with warm vocals.',
    }).success).toBe(false);

    expect(GenerateMusicSchema.safeParse({
      model: 'music-cover',
      coverFeatureId: 'cover-feature-1',
      prompt: 'Acoustic folk cover with warm vocals.',
      instrumental: true,
    }).success).toBe(false);
  });
});

describe('GenerateMusicSchema', () => {
  it('accepts a vocal music request with safe defaults', () => {
    const result = GenerateMusicSchema.safeParse({
      prompt: 'Glossy synth-pop with a bright chorus.',
      lyrics: '[Verse]\nCity lights keep moving\n[Chorus]\nWe rise again',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model).toBe('music-3.0');
      expect(result.data.instrumental).toBe(false);
      expect(result.data.stream).toBe(false);
      expect(result.data.outputFormat).toBe('hex');
      expect(result.data.audioSetting).toEqual({ sampleRate: 44100, bitrate: 256000, format: 'mp3' });
    }
  });

  it('accepts instrumental music when prompt is provided and lyrics are omitted', () => {
    const result = GenerateMusicSchema.safeParse({
      instrumental: true,
      prompt: 'Instrumental cinematic piano with soft strings.',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lyrics).toBe('');
    }
  });

  it('rejects impossible music generation states', () => {
    expect(GenerateMusicSchema.safeParse({ instrumental: true, prompt: '' }).success).toBe(false);
    expect(GenerateMusicSchema.safeParse({ instrumental: false, lyrics: '' }).success).toBe(false);
    expect(GenerateMusicSchema.safeParse({ lyrics: 'a'.repeat(3501) }).success).toBe(false);
    expect(GenerateMusicSchema.safeParse({ instrumental: true, prompt: 'a'.repeat(2001) }).success).toBe(false);
  });

  it('accepts cover generation with a cover feature ID and optional lyrics', () => {
    const result = GenerateMusicSchema.safeParse({
      model: 'music-cover',
      coverFeatureId: 'cover-feature-1',
      prompt: 'Acoustic folk cover with warm vocals.',
      lyrics: '',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.instrumental).toBe(false);
      expect(result.data.coverFeatureId).toBe('cover-feature-1');
    }
  });

  it('rejects invalid cover generation states', () => {
    expect(GenerateMusicSchema.safeParse({
      model: 'music-cover',
      prompt: 'Acoustic folk cover with warm vocals.',
    }).success).toBe(false);
    expect(GenerateMusicSchema.safeParse({
      model: 'music-cover',
      coverFeatureId: 'cover-feature-1',
      prompt: 'short',
    }).success).toBe(false);
    expect(GenerateMusicSchema.safeParse({
      model: 'music-cover-free',
      coverFeatureId: 'cover-feature-1',
      prompt: 'a'.repeat(301),
    }).success).toBe(false);
    expect(GenerateMusicSchema.safeParse({
      model: 'music-cover',
      coverFeatureId: 'cover-feature-1',
      prompt: 'Acoustic folk cover with warm vocals.',
      lyrics: 'too few',
    }).success).toBe(false);
    expect(GenerateMusicSchema.safeParse({
      model: 'music-cover',
      coverFeatureId: 'cover-feature-1',
      prompt: 'Acoustic folk cover with warm vocals.',
      lyrics: 'a'.repeat(1001),
    }).success).toBe(false);
    expect(GenerateMusicSchema.safeParse({
      model: 'music-cover',
      coverFeatureId: 'cover-feature-1',
      prompt: 'Acoustic folk cover with warm vocals.',
      instrumental: true,
    }).success).toBe(false);
  });

  it('rejects unsupported music output settings', () => {
    expect(GenerateMusicSchema.safeParse({
      prompt: 'test',
      lyrics: 'lyrics',
      outputFormat: 'url',
    }).success).toBe(false);
    expect(GenerateMusicSchema.safeParse({
      prompt: 'test',
      lyrics: 'lyrics',
      audioSetting: { sampleRate: 48000, bitrate: 256000, format: 'mp3' },
    }).success).toBe(false);
  });
});

describe('GenerateLyricsSchema', () => {
  it('accepts full-song lyrics requests with documented optional fields', () => {
    const result = GenerateLyricsSchema.safeParse({
      mode: 'write_full_song',
      prompt: 'Hopeful synth-pop about rebuilding trust.',
      title: 'Neon Afterglow',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lyrics).toBe('');
    }
  });

  it('accepts edit mode lyrics and rejects invalid modes or length limits', () => {
    expect(GenerateLyricsSchema.safeParse({
      mode: 'edit',
      lyrics: '[Verse]\nOld draft',
      prompt: 'Make the chorus stronger.',
    }).success).toBe(true);
    expect(GenerateLyricsSchema.safeParse({ mode: 'rewrite' }).success).toBe(false);
    expect(GenerateLyricsSchema.safeParse({ mode: 'write_full_song', prompt: 'a'.repeat(2001) }).success).toBe(false);
    expect(GenerateLyricsSchema.safeParse({ mode: 'edit', lyrics: 'a'.repeat(3501) }).success).toBe(false);
  });

  it('requires a prompt to write a full song and lyrics to edit', () => {
    const emptySong = GenerateLyricsSchema.safeParse({ mode: 'write_full_song' });
    expect(emptySong.success).toBe(false);
    if (!emptySong.success) {
      expect(emptySong.error.issues.map((issue) => issue.path.join('.'))).toContain('prompt');
    }

    const emptyEdit = GenerateLyricsSchema.safeParse({
      mode: 'edit',
      prompt: 'Make the chorus stronger.',
    });
    expect(emptyEdit.success).toBe(false);
    if (!emptyEdit.success) {
      expect(emptyEdit.error.issues.map((issue) => issue.path.join('.'))).toContain('lyrics');
    }
  });
});

describe('MusicCoverPreprocessSchema', () => {
  const audioBase64 = Buffer.from('reference audio').toString('base64');

  it('accepts exactly one reference audio source', () => {
    expect(MusicCoverPreprocessSchema.safeParse({ audioUrl: 'https://example.com/reference.mp3' }).success).toBe(true);
    expect(MusicCoverPreprocessSchema.safeParse({ audioBase64 }).success).toBe(true);
    expect(MusicCoverPreprocessSchema.safeParse({ audioBase64: `data:audio/mpeg;base64,${audioBase64}` }).success).toBe(true);
  });

  it('rejects missing, duplicate, invalid, or oversized cover preprocess inputs', () => {
    expect(MusicCoverPreprocessSchema.safeParse({}).success).toBe(false);
    expect(MusicCoverPreprocessSchema.safeParse({ audioUrl: 'https://example.com/reference.mp3', audioBase64 }).success).toBe(false);
    expect(MusicCoverPreprocessSchema.safeParse({ audioUrl: 'ftp://example.com/reference.mp3' }).success).toBe(false);
    expect(MusicCoverPreprocessSchema.safeParse({ audioBase64: 'not base64' }).success).toBe(false);
    expect(MusicCoverPreprocessSchema.safeParse({ audioBase64: 'a'.repeat(69_905_072) }).success).toBe(false);
  });
});
