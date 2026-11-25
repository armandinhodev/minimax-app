/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import {
  ASR_MAX_AUDIO_SECONDS,
  ASR_MAX_FILE_SIZE_BYTES,
  AsrTranscriptionOptionsSchema,
  getAudioExtension,
  getSubtitleContentType,
  validateAudioFile,
} from './AsrDTO';

describe('AsrTranscriptionOptionsSchema', () => {
  it('applies the documented defaults', () => {
    const parsed = AsrTranscriptionOptionsSchema.parse({});

    expect(parsed).toEqual({
      model: 'asr-1.0',
      responseFormat: 'json',
      timestampLevel: '',
      language: '',
      stream: false,
    });
  });

  it('accepts every documented response format', () => {
    for (const responseFormat of ['json', 'verbose_json', 'srt', 'vtt']) {
      const parsed = AsrTranscriptionOptionsSchema.safeParse({ responseFormat });
      expect(parsed.success).toBe(true);
    }
  });

  it('rejects an unknown response format', () => {
    expect(AsrTranscriptionOptionsSchema.safeParse({ responseFormat: 'xml' }).success).toBe(false);
  });

  it('rejects diarization formats combined with streaming', () => {
    for (const responseFormat of ['verbose_json', 'srt', 'vtt']) {
      const parsed = AsrTranscriptionOptionsSchema.safeParse({ responseFormat, stream: true });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.map((issue) => issue.message).join(' ')).toContain(
          'cannot be combined with streaming',
        );
      }
    }
  });

  it('accepts streaming with the plain json format', () => {
    const parsed = AsrTranscriptionOptionsSchema.safeParse({ responseFormat: 'json', stream: true });
    expect(parsed.success).toBe(true);
  });
});

describe('validateAudioFile', () => {
  it('accepts a documented container within the size limit', () => {
    expect(validateAudioFile('meeting.wav', 1024)).toBeNull();
    expect(validateAudioFile('voice.m4a', 1024)).toBeNull();
    expect(validateAudioFile('clip.opus', 1024)).toBeNull();
  });

  it('rejects an empty file', () => {
    expect(validateAudioFile('meeting.wav', 0)).toBe('The audio file is empty');
  });

  it('rejects a file over 50MB', () => {
    const message = validateAudioFile('meeting.wav', ASR_MAX_FILE_SIZE_BYTES + 1);
    expect(message).toBe('Audio must be 50MB or smaller');
  });

  it('rejects an unsupported container', () => {
    expect(validateAudioFile('notes.txt', 1024)).toContain('Unsupported audio format');
    expect(validateAudioFile('noextension', 1024)).toContain('Unsupported audio format');
  });
});

describe('getAudioExtension', () => {
  it('lowercases the extension and returns an empty string when there is none', () => {
    expect(getAudioExtension('Take.WAV')).toBe('wav');
    expect(getAudioExtension('archive.tar.gz')).toBe('gz');
    expect(getAudioExtension('noextension')).toBe('');
    expect(getAudioExtension('trailing.')).toBe('');
  });
});

describe('ASR limits', () => {
  it('pins the documented duration and size ceilings', () => {
    expect(ASR_MAX_AUDIO_SECONDS).toBe(500);
    expect(ASR_MAX_FILE_SIZE_BYTES).toBe(50 * 1024 * 1024);
  });
});

describe('getSubtitleContentType', () => {
  it('maps the subtitle formats to their content types', () => {
    expect(getSubtitleContentType('srt')).toBe('text/plain');
    expect(getSubtitleContentType('vtt')).toBe('text/vtt');
  });
});
