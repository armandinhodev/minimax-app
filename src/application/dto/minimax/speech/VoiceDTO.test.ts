/** @vitest-environment node */

/**
 * VoiceDTO — schemas de validación del DTO.
 */

import { describe, expect, it } from 'vitest';
import { CloneVoiceSchema, DeleteVoiceSchema, DesignVoiceSchema, GetVoicesSchema } from './VoiceDTO';

describe('CloneVoiceSchema', () => {
  it('accepts valid clone voice request', () => {
    const result = CloneVoiceSchema.safeParse({
      fileId: 'file_abc123',
      voiceId: 'my_clone_voice_1',
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional clone prompt fields', () => {
    const result = CloneVoiceSchema.safeParse({
      fileId: 'file_abc123',
      voiceId: 'my_clone_voice_1',
      optionalClonePrompt: {
        promptAudio: 'file_prompt_123',
        promptText: 'Hello world',
      },
      optionalPreviewText: 'Preview text',
      optionalModel: 'speech-2.8-hd',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty fileId', () => {
    const result = CloneVoiceSchema.safeParse({
      fileId: '',
      voiceId: 'my_clone_voice_1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid voice_id format', () => {
    const result = CloneVoiceSchema.safeParse({
      fileId: 'file_abc123',
      voiceId: '-invalid', // must start with letter
    });
    expect(result.success).toBe(false);
  });
});

describe('DesignVoiceSchema', () => {
  it('accepts valid design voice request', () => {
    const result = DesignVoiceSchema.safeParse({
      prompt: 'A warm female voice with a British accent',
      previewText: 'Hello world',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty prompt', () => {
    const result = DesignVoiceSchema.safeParse({
      prompt: '',
      previewText: 'Hello',
    });
    expect(result.success).toBe(false);
  });

  it('rejects prompt exceeding 2000 characters', () => {
    const result = DesignVoiceSchema.safeParse({
      prompt: 'a'.repeat(2001),
      previewText: 'Hello',
    });
    expect(result.success).toBe(false);
  });

  it('rejects preview text exceeding 500 characters', () => {
    const result = DesignVoiceSchema.safeParse({
      prompt: 'A warm female voice',
      previewText: 'a'.repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe('GetVoicesSchema', () => {
  it('accepts valid voice type enum values', () => {
    const types = ['system', 'voice_cloning', 'voice_generation', 'all'] as const;
    for (const voiceType of types) {
      const result = GetVoicesSchema.safeParse({ voiceType });
      expect(result.success).toBe(true);
    }
  });

  it('defaults to all', () => {
    const result = GetVoicesSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.voiceType).toBe('all');
    }
  });

  it('rejects invalid voice type', () => {
    const result = GetVoicesSchema.safeParse({ voiceType: 'invalid' });
    expect(result.success).toBe(false);
  });
});

describe('DeleteVoiceSchema', () => {
  it('accepts valid delete voice request', () => {
    const result = DeleteVoiceSchema.safeParse({
      voiceId: 'clone_voice_123',
      voiceType: 'voice_cloning',
    });
    expect(result.success).toBe(true);
  });

  it('defaults voiceType to voice_cloning', () => {
    const result = DeleteVoiceSchema.safeParse({
      voiceId: 'clone_voice_123',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.voiceType).toBe('voice_cloning');
    }
  });

  it('rejects invalid voice type', () => {
    const result = DeleteVoiceSchema.safeParse({
      voiceId: 'clone_voice_123',
      voiceType: 'system',
    });
    expect(result.success).toBe(false);
  });
});
