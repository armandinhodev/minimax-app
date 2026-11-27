import { describe, expect, it } from 'vitest';

import { PRODUCT_NAV_SECTIONS, isNavItemActive, matchesPath } from './nav-config';

function section(id: string) {
  const found = PRODUCT_NAV_SECTIONS.find((item) => item.id === id);
  if (!found) throw new Error(`Section not found: ${id}`);
  return found;
}

describe('video navigation section', () => {
  it('exposes one item per mode, without a redundant studio entry', () => {
    const items = section('video').groups.flatMap((group) => group.items);

    expect(items.map((item) => item.href)).toEqual([
      '/video/generation',
      '/video/context-ir',
      '/video/regeneration',
      '/video/tasks',
    ]);
    expect(items.some((item) => item.href === '/video')).toBe(false);
  });

  it('marks the section active on every video route', () => {
    expect(matchesPath('/video/generation', section('video').matchPaths)).toBe(true);
    expect(matchesPath('/video/tasks', section('video').matchPaths)).toBe(true);
    expect(matchesPath('/video', section('video').matchPaths)).toBe(true);
    expect(matchesPath('/video-agent', section('video').matchPaths)).toBe(false);
  });

  it('marks exactly one item active per route', () => {
    const items = section('video').groups.flatMap((group) => group.items);

    for (const pathname of ['/video/generation', '/video/context-ir', '/video/regeneration', '/video/tasks']) {
      const active = items.filter((item) => isNavItemActive(pathname, item));
      expect(active).toHaveLength(1);
      expect(active[0].href).toBe(pathname);
    }
  });
});

describe('speech navigation section', () => {
  it('groups text to speech and transcription under one area', () => {
    const speech = PRODUCT_NAV_SECTIONS.find((item) => item.id === 'speech');
    if (!speech) throw new Error('Speech section not found');

    expect(PRODUCT_NAV_SECTIONS.map((item) => item.id)).toEqual([
      'speech',
      'text',
      'image',
      'music',
      'video',
      'video-agent',
      'library',
    ]);
    expect(speech.matchPaths).toEqual(['/tts', '/voices', '/asr']);
    expect(speech.groups.flatMap((group) => group.items).map((item) => item.href)).toEqual([
      '/tts',
      '/asr',
      '/voices',
      '/voices/clone',
      '/voices/design',
    ]);
  });
});
