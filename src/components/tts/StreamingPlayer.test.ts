import { describe, expect, it } from 'vitest';
import { NonRetryableStreamError, base64ToUint8Array, decodeAudioPayload, isHexPayload, parseStreamingAudioPayload, shouldFailCompletedStream, shouldRetryStreamFailure } from './StreamingPlayer';

describe('base64ToUint8Array', () => {
  it('decodes a complete base64 chunk', () => {
    expect(Array.from(base64ToUint8Array('AAEC/w=='))).toEqual([0, 1, 2, 255]);
  });
});

describe('isHexPayload', () => {
  it('detects the lowercase even-length hex MiniMax streams', () => {
    expect(isHexPayload('deadbeef')).toBe(true);
    expect(isHexPayload('00ff')).toBe(true);
  });

  it('rejects base64 payloads and odd-length strings', () => {
    expect(isHexPayload('SGVsbG8=')).toBe(false);
    expect(isHexPayload('abc')).toBe(false);
    expect(isHexPayload('')).toBe(false);
  });
});

describe('decodeAudioPayload', () => {
  it('decodes hex payloads', () => {
    expect(Array.from(decodeAudioPayload('deadbeef'))).toEqual([0xde, 0xad, 0xbe, 0xef]);
  });

  it('falls back to base64 for payloads that are not hex', () => {
    expect(Array.from(decodeAudioPayload('AAEC/w=='))).toEqual([0, 1, 2, 255]);
  });
});

describe('parseStreamingAudioPayload', () => {
  it('parses the upstream shape with the audio nested under data', () => {
    const result = parseStreamingAudioPayload('{"data":{"audio":"deadbeef","status":2},"extra_info":{"usage_characters":12}}');

    expect(result.kind).toBe('audio');
    if (result.kind === 'audio') {
      expect(Array.from(result.bytes)).toEqual([0xde, 0xad, 0xbe, 0xef]);
    }
  });

  it('reports the error shape of the relay', () => {
    expect(parseStreamingAudioPayload('{"error":{"message":"boom"}}')).toEqual({
      kind: 'error',
      reason: 'boom',
    });
  });

  it('parses valid base64 audio payloads into bytes', () => {
    const result = parseStreamingAudioPayload('{"audio":"SGVsbG8="}');

    expect(result.kind).toBe('audio');
    if (result.kind === 'audio') {
      expect(Array.from(result.bytes)).toEqual([72, 101, 108, 108, 111]);
    }
  });

  it('ignores done markers and empty payloads', () => {
    expect(parseStreamingAudioPayload('[DONE]')).toEqual({ kind: 'ignore' });
    expect(parseStreamingAudioPayload('   ')).toEqual({ kind: 'ignore' });
  });

  it('flags malformed payloads as errors', () => {
    expect(parseStreamingAudioPayload('not-json')).toEqual({
      kind: 'error',
      reason: 'Invalid streaming audio payload.',
    });
  });
});

describe('shouldFailCompletedStream', () => {
  it('fails completed streams when no playable audio was decoded', () => {
    expect(shouldFailCompletedStream(false, false)).toBe(true);
  });

  it('fails completed streams when corrupt chunks were detected', () => {
    expect(shouldFailCompletedStream(true, true)).toBe(true);
  });

  it('allows completion when valid audio played without fatal chunk errors', () => {
    expect(shouldFailCompletedStream(false, true)).toBe(false);
  });

  it('treats repeated corrupt 200-stream decode failures as non-retryable', () => {
    expect(shouldRetryStreamFailure(new NonRetryableStreamError('Streaming audio payload could not be decoded.'))).toBe(false);
  });
});
