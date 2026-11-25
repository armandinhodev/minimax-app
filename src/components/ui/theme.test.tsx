// @vitest-environment node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultSystem } from '@chakra-ui/react';
import { describe, expect, it } from 'vitest';
import { Provider } from './provider';
import { system } from './theme';

const stylesheets = [
  'src/app/globals.css',
  'src/components/navigation/navigation.module.css',
];

describe('application color system', () => {
  it('centralizes stylesheet colors in resolvable Chakra tokens', () => {
    for (const stylesheet of stylesheets) {
      const css = readFileSync(path.resolve(stylesheet), 'utf8');
      expect(css).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(|\bwhite\b/i);
      const references = [...css.matchAll(/var\((--chakra-colors-[\w-]+)\)/g)];
      expect(references.length).toBeGreaterThan(0);
      for (const [, variable] of references) {
        expect(system.tokens.cssVarMap.get('base')?.has(variable), variable).toBe(true);
      }
    }
  });

  it('preserves the existing palette and Chakra defaults', () => {
    expect(system.token('colors.app.slate.900')).toBe('#0f172a');
    expect(system.token('colors.app.speech')).toBe('#38bdf8');
    expect(system.token('colors.app.image')).toBe('#a78bfa');
    expect(system.token('colors.app.music')).toBe('#f472b6');
    expect(system.token('colors.app.library')).toBe('#34d399');
    expect(system.token('colors.app.scrollbar')).toBe('#d1d5db');
    expect(system.token('colors.blue.500')).toBe(defaultSystem.token('colors.blue.500'));
  });

  it('provides the application tokens globally without changing its children', () => {
    const html = renderToStaticMarkup(<Provider><span>Application content</span></Provider>);
    expect(html).toContain('<span>Application content</span>');
    expect(html).toContain('--chakra-colors-navigation-text');
    expect(html).toContain('--chakra-colors-scrollbar-thumb');
    expect(html).toContain('--chakra-colors-app-music:#f472b6');
  });
});
