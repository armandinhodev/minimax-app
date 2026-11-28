import { describe, expect, it } from 'vitest';

import { insertEmotionTag } from './emotion-tag';

describe('insertEmotionTag', () => {
  it('places the tag after the selected word without replacing it', () => {
    const result = insertEmotionTag('people then the next line', 0, 6, 'sighs');

    expect(result.text).toBe('people(sighs) then the next line');
    expect(result.caret).toBe(13);
  });

  it('inserts at the caret when there is no selection', () => {
    const result = insertEmotionTag('Omg, that was close.', 3, 3, 'sighs');

    expect(result.text).toBe('Omg(sighs), that was close.');
  });

  it('appends when the control has no selection information', () => {
    expect(insertEmotionTag('Hello', null, null, 'laughs').text).toBe('Hello(laughs)');
  });
});
