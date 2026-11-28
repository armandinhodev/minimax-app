import { describe, expect, it } from 'vitest';

import { getMediaReferenceLabel, joinMediaReferences, mediaReferenceId, rememberMediaReference, splitMediaReferences } from './media-references';

describe('media references', () => {
  it('splits comma separated references and trims them', () => {
    expect(splitMediaReferences(' https://a.example/1.png , mm_file://123,https://b.example/2.png ')).toEqual([
      'https://a.example/1.png',
      'mm_file://123',
      'https://b.example/2.png',
    ]);
  });

  it('keeps a data URL whole even though it carries commas', () => {
    const dataUrl = 'data:image/png;base64,AAAA,BBBB';

    expect(splitMediaReferences(`mm_file://123, ${dataUrl}`)).toEqual(['mm_file://123', dataUrl]);
    expect(joinMediaReferences(['mm_file://123', dataUrl])).toBe('mm_file://123, data:image/png;base64,AAAA,BBBB');
  });

  it('ignores empty entries', () => {
    expect(splitMediaReferences(' , ')).toEqual([]);
    expect(splitMediaReferences('')).toEqual([]);
  });

  it('reads the MiniMax id and remembers the file name', () => {
    expect(mediaReferenceId('mm_file://468100274467142')).toBe('468100274467142');
    expect(mediaReferenceId('https://a.example/1.png')).toBeNull();

    rememberMediaReference('mm_file://468100274467142', 'copper.png', 2048);
    expect(getMediaReferenceLabel('mm_file://468100274467142')).toEqual({ fileName: 'copper.png', size: 2048 });
    expect(getMediaReferenceLabel('mm_file://999')).toEqual({ fileName: 'MiniMax file 999', size: null });
    expect(getMediaReferenceLabel('https://a.example/1.png')).toBeNull();
  });
});
