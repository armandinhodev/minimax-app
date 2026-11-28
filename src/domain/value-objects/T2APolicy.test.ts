/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import { T2A_EMOTIONS, emotionsForModel, supportsInterjectionTags } from './T2APolicy';

describe('T2A emotion policy', () => {
  it('offers the documented presets for Speech 2.8 and 01', () => {
    const presets = emotionsForModel('speech-2.8-hd');
    expect(presets).toEqual(['happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'calm']);
  });

  it('adds fluent and whisper for Speech 2.6', () => {
    const presets = emotionsForModel('speech-2.6-hd');
    expect(presets).toEqual([...T2A_EMOTIONS]);
  });

  it('allows inline interjection tags only on Speech 2.8', () => {
    expect(supportsInterjectionTags('speech-2.8-hd')).toBe(true);
    expect(supportsInterjectionTags('speech-2.8-turbo')).toBe(true);
    expect(supportsInterjectionTags('speech-2.6-hd')).toBe(false);
    expect(supportsInterjectionTags('speech-01')).toBe(false);
  });
});
