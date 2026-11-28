/** @vitest-environment node */

/**
 * SpeechDTO — schemas de validación del DTO.
 */

import { describe, expect, it } from 'vitest';
import { StreamT2ASchema, SubmitAsyncT2ASchema, SynthesizeT2ASchema } from './SpeechDTO';

describe('SynthesizeT2ASchema', () => {
  it('accepts valid T2A request', () => {
    const result = SynthesizeT2ASchema.safeParse({
      text: 'Hello world',
      voiceId: 'sys_male_english_1',
      model: 'speech-2.8-hd',
      format: 'mp3',
    });
    expect(result.success).toBe(true);
  });

  it('accepts minimal valid request with defaults', () => {
    const result = SynthesizeT2ASchema.safeParse({
      text: 'Hello world',
      voiceId: 'sys_male_english_1',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model).toBe('speech-2.8-hd');
      expect(result.data.format).toBe('mp3');
    }
  });

  it('rejects empty text', () => {
    const result = SynthesizeT2ASchema.safeParse({
      text: '',
      voiceId: 'sys_male_english_1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects text exceeding 10,000 characters', () => {
    const result = SynthesizeT2ASchema.safeParse({
      text: 'a'.repeat(10001),
      voiceId: 'sys_male_english_1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid voice_id format', () => {
    const result = SynthesizeT2ASchema.safeParse({
      text: 'Hello',
      voiceId: '123-invalid', // must start with letter
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid format', () => {
    const result = SynthesizeT2ASchema.safeParse({
      text: 'Hello',
      voiceId: 'sys_male_english_1',
      format: 'invalid_format',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a documented emotion preset and rejects an unknown one', () => {
    expect(SynthesizeT2ASchema.safeParse({
      text: 'Hello',
      voiceId: 'sys_male_english_1',
      emotion: 'happy',
    }).success).toBe(true);

    expect(SynthesizeT2ASchema.safeParse({
      text: 'Hello',
      voiceId: 'sys_male_english_1',
      emotion: 'ecstatic',
    }).success).toBe(false);
  });
});

describe('StreamT2ASchema', () => {
  it('accepts valid stream request', () => {
    const result = StreamT2ASchema.safeParse({
      text: 'Streaming text',
      voiceId: 'sys_female_english_1',
      model: 'speech-2.8',
    });
    expect(result.success).toBe(true);
  });

  it('rejects text exceeding 10,000 characters', () => {
    const result = StreamT2ASchema.safeParse({
      text: 'a'.repeat(10001),
      voiceId: 'sys_male_english_1',
    });
    expect(result.success).toBe(false);
  });
});

describe('SubmitAsyncT2ASchema', () => {
  it('accepts valid async submit request', () => {
    const result = SubmitAsyncT2ASchema.safeParse({
      text: 'Long text up to 1M chars',
      voiceId: 'sys_male_english_1',
    });
    expect(result.success).toBe(true);
  });

  it('accepts inline text up to 100,000 characters', () => {
    const result = SubmitAsyncT2ASchema.safeParse({
      text: 'a'.repeat(100_000),
      voiceId: 'sys_male_english_1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects inline text exceeding 100,000 characters', () => {
    const result = SubmitAsyncT2ASchema.safeParse({
      text: 'a'.repeat(100_001),
      voiceId: 'sys_male_english_1',
    });
    expect(result.success).toBe(false);
  });
});
