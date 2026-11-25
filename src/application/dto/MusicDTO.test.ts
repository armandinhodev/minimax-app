import { describe, expect, it } from 'vitest';

import {
  GenerateMusicSchema,
  MUSIC_AVAILABILITY_NOTICE,
  MusicModelSchema,
  MusicOutputFormatSchema,
} from './MusicDTO';

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
