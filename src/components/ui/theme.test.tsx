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

  it('keeps the bench palette described in docs/design.md', () => {
    expect(system.token('colors.bench.console')).toBe('#14181D');
    expect(system.token('colors.bench.seam')).toBe('#2B323B');
    expect(system.token('colors.bench.sheet')).toBe('var(--chakra-colors-surface-sheet)');
    expect(system.token('colors.bench.field')).toBe('#EEF0F2');
    expect(system.token('colors.bench.rule')).toBe('#D7DCE1');
    expect(system.token('colors.bench.ink')).toBe('#0F1216');
    expect(system.token('colors.bench.readout')).toBe('#5C6673');
    expect(system.token('colors.bench.accent')).toBe('#1F5E6B');
  });

  it('has a single interactive accent', () => {
    const accents = system.token('colors.bench.accent');
    expect(accents).toBe('#1F5E6B');

    // No per-product accent palette survives the redesign.
    expect(system.token('colors.bench.speech')).toBeUndefined();
    expect(system.token('colors.bench.image')).toBeUndefined();
    expect(system.token('colors.bench.music')).toBeUndefined();
    expect(system.token('colors.bench.video')).toBeUndefined();
  });

  it('wires the two typefaces and keeps the radius machined', () => {
    expect(system.token('fonts.body')).toContain('--font-archivo');
    expect(system.token('fonts.mono')).toContain('--font-plex-mono');

    // Equipment is machined, not pillowy: nothing rounds past 4px.
    for (const radius of ['sm', 'md', 'lg', 'xl', '2xl']) {
      const value = String(system.token(`radii.${radius}`));
      expect(parseFloat(value), radius).toBeLessThanOrEqual(4);
    }
  });

  it('keeps the Chakra default palette available', () => {
    expect(system.token('colors.blue.500')).toBe(defaultSystem.token('colors.blue.500'));
  });

  it('provides the application tokens globally without changing its children', () => {
    const html = renderToStaticMarkup(<Provider><span>Application content</span></Provider>);
    expect(html).toContain('<span>Application content</span>');
    expect(html).toContain('--chakra-colors-console-text');
    expect(html).toContain('--chakra-colors-surface-sheet');
    expect(html).toContain('--chakra-colors-interaction-accent');
  });
});
