import { describe, expect, it } from 'vitest';

import {
  FileDeletePurposeSchema,
  FileListPurposeSchema,
  FileUploadPurposeSchema,
  quoteMiniMaxInt64Fields,
  rawMiniMaxInt64,
  stringifyMiniMaxJson,
} from './FileDTO';

describe('MiniMax file purposes', () => {
  it('exposes the purposes documented for POST /v1/files/upload', () => {
    expect(FileUploadPurposeSchema.options).toEqual([
      'voice_clone',
      'prompt_audio',
      't2a_async_input',
      'video_understanding',
      'video_generation_input',
      'image_generation_input',
    ]);
    expect(FileUploadPurposeSchema.safeParse('video_generation_input').success).toBe(true);
    expect(FileUploadPurposeSchema.safeParse('image_generation_input').success).toBe(true);
    expect(FileUploadPurposeSchema.safeParse('t2a_async').success).toBe(false);
  });

  it('exposes the purposes documented for GET /v1/files/list', () => {
    expect(FileListPurposeSchema.options).toEqual([
      'voice_clone',
      'prompt_audio',
      't2a_async_input',
      'video_generation_input',
      'image_generation_input',
    ]);
    expect(FileListPurposeSchema.safeParse('video_generation_input').success).toBe(true);
    expect(FileListPurposeSchema.safeParse('t2a_async').success).toBe(false);
  });

  it('exposes the purposes documented for POST /v1/files/delete', () => {
    expect(FileDeletePurposeSchema.safeParse('t2a_async').success).toBe(true);
    expect(FileDeletePurposeSchema.safeParse('video_generation').success).toBe(true);
    expect(FileDeletePurposeSchema.safeParse('image_generation_input').success).toBe(true);
    expect(FileDeletePurposeSchema.safeParse('not_a_purpose').success).toBe(false);
  });
});

describe('MiniMax int64 identifiers', () => {
  it('keeps int64 identifiers exact when parsing an upstream JSON body', () => {
    const body = '{"file":{"file_id":123456789012345681,"bytes":10}}';
    const parsed = JSON.parse(quoteMiniMaxInt64Fields(body));

    expect(parsed.file.file_id).toBe('123456789012345681');
  });

  it('serializes int64 identifiers as exact numeric literals', () => {
    const raw = rawMiniMaxInt64('123456789012345681');

    expect(stringifyMiniMaxJson({ file_id: raw, purpose: 'voice_clone' }))
      .toBe('{"file_id":123456789012345681,"purpose":"voice_clone"}');
  });

  it('rejects identifiers MiniMax would not accept', () => {
    expect(rawMiniMaxInt64('file_123')).toBeNull();
    expect(rawMiniMaxInt64('')).toBeNull();
  });
});
