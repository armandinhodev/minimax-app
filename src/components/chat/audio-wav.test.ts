// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { encodeWav } from './audio-wav';

describe('encodeWav', () => {
  it('writes a mono 16-bit PCM WAV header and the samples', async () => {
    const blob = encodeWav(new Float32Array([0, 1, -1]), 16_000);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const view = new DataView(bytes.buffer);

    expect(blob.type).toBe('audio/wav');
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe('WAVE');
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(6);
    expect(bytes.length).toBe(44 + 6);
  });

  it('clamps samples outside [-1, 1]', async () => {
    const blob = encodeWav(new Float32Array([2, -2]), 16_000);
    const view = new DataView(await blob.arrayBuffer());

    expect(view.getInt16(44, true)).toBe(32_767);
    expect(view.getInt16(46, true)).toBe(-32_768);
  });
});
