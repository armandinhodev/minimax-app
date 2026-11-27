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

type Rgb = [number, number, number];

function toRgb(value: string): Rgb {
  const hex = value.replace('#', '');
  return [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255) as Rgb;
}

function channel(value: number): number {
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(value: string): number {
  const [r, g, b] = toRgb(value).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

/** Hue in degrees plus saturation and lightness, from 0 to 100. */
function hsl(value: string): { hue: number; saturation: number; lightness: number } {
  const [r, g, b] = toRgb(value);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;

  if (delta === 0) return { hue: 0, saturation: 0, lightness: lightness * 100 };

  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;

  hue *= 60;
  if (hue < 0) hue += 360;

  return {
    hue,
    saturation: (delta / (1 - Math.abs(2 * lightness - 1))) * 100,
    lightness: lightness * 100,
  };
}

/** The base palette, as docs/design.md describes it. */
const PALETTE: Record<string, string> = {
  'bench.ink': '#171A16',
  'bench.graphite': '#232B25',
  'bench.seam': '#33403A',
  'bench.workspace': '#E9E4D8',
  'bench.sheet': '#FCFAF4',
  'bench.plate': '#FFFDF8',
  'bench.rule': '#CFC7B8',
  'bench.readout': '#6A645A',
  'bench.accent': '#1F5B45',
  'bench.ok': '#2C6E4A',
  'bench.run': '#A25F16',
  'bench.err': '#A8332B',
  'bench.rail': '#EFE7D7',
};

/** Text pairs a screen actually renders, with the concrete palette values. */
const TEXT_PAIRS: Array<[string, string]> = [
  ['bench.ink', 'bench.sheet'],
  ['bench.ink', 'bench.rail'],
  ['bench.readout', 'bench.rail'],
  ['bench.readout', 'bench.sheet'],
  ['content.subtle', 'bench.sheet'],
  ['bench.ink', 'bench.workspace'],
  ['bench.ink', 'bench.plate'],
  ['bench.readout', 'bench.workspace'],
  ['content.inverse', 'bench.accent'],
  ['transport.text', 'transport.bg'],
  ['transport.muted', 'transport.bg'],
  ['transport.faint', 'transport.bg'],
  ['bench.ok', 'bench.sheet'],
  ['bench.run', 'bench.sheet'],
  ['bench.err', 'bench.sheet'],
  ['bench.accent', 'bench.sheet'],
];

describe('application color system', () => {
  it('centralizes stylesheet colors in resolvable Chakra tokens', () => {
    for (const stylesheet of stylesheets) {
      const css = readFileSync(path.resolve(stylesheet), 'utf8');
      expect(css).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(|:\s*white\b/i);
      const references = [...css.matchAll(/var\((--chakra-colors-[\w-]+)\)/g)];
      expect(references.length).toBeGreaterThan(0);
      for (const [, variable] of references) {
        expect(system.tokens.cssVarMap.get('base')?.has(variable), variable).toBe(true);
      }
    }
  });

  it('keeps the cutting-room palette described in docs/design.md', () => {
    for (const [token, value] of Object.entries(PALETTE)) {
      expect(system.token(`colors.${token}`), token).toBe(value);
    }
  });

  it('has a single interactive accent', () => {
    expect(system.token('colors.bench.accent')).toBe('#1F5B45');

    // No per-product accent palette survives the redesign.
    expect(system.token('colors.bench.speech')).toBeUndefined();
    expect(system.token('colors.bench.image')).toBeUndefined();
    expect(system.token('colors.bench.music')).toBeUndefined();
    expect(system.token('colors.bench.video')).toBeUndefined();
  });

  it('keeps fuchsia and magenta out of the palette', () => {
    // The brief asks for a modern palette without the fuchsia family: any
    // hue between 285 and 345 with real saturation is a regression.
    const fuchsia: string[] = [];

    for (const [token, value] of Object.entries(PALETTE)) {
      const { hue, saturation } = hsl(value);
      if (hue >= 285 && hue <= 345 && saturation > 15) {
        fuchsia.push(`${token} ${value} (hue ${Math.round(hue)})`);
      }
    }

    expect(fuchsia).toEqual([]);
  });

  it('keeps every text pair legible', () => {
    const dim: string[] = [];

    for (const [foreground, background] of TEXT_PAIRS) {
      const fg = String(system.token(`colors.${foreground}`));
      const bg = String(system.token(`colors.${background}`));
      const ratio = contrast(fg, bg);
      if (ratio < 4.5) dim.push(`${foreground} on ${background}: ${ratio.toFixed(2)}:1`);
    }

    expect(dim).toEqual([]);
  });

  it('wires the two typefaces and keeps the radius cut, not moulded', () => {
    expect(system.token('fonts.body')).toContain('--font-bricolage');
    expect(system.token('fonts.mono')).toContain('--font-dm-mono');
    expect(system.token('fontSizes.display')).toBe('2.125rem');
    expect(system.token('fontSizes.title')).toBe('1.25rem');
    expect(system.token('fontSizes.body')).toBe('0.9375rem');

    // A panel is 6px at most; a control stays at 4px.
    expect(parseFloat(String(system.token('radii.lg')))).toBeLessThanOrEqual(6);
    expect(parseFloat(String(system.token('radii.md')))).toBeLessThanOrEqual(4);
    expect(parseFloat(String(system.token('radii.xl')))).toBeLessThanOrEqual(8);
    expect(system.token('radii.2xl')).toBe('10px');
  });

  it('keeps the plate and the state tokens the screens use', () => {
    const variables = system.tokens.cssVarMap.get('base');
    for (const token of [
      '--chakra-colors-surface-plate',
      '--chakra-colors-surface-rail',
      '--chakra-colors-surface-grid',
      '--chakra-colors-transport-text',
      '--chakra-colors-interaction-accent-bright',
      '--chakra-colors-interaction-accent-strong',
      '--chakra-colors-state-err-bright',
    ]) {
      expect(variables?.has(token), token).toBe(true);
    }
  });

  it('keeps the Chakra default palette available', () => {
    expect(system.token('colors.blue.500')).toBe(defaultSystem.token('colors.blue.500'));
  });

  it('provides the application tokens globally without changing its children', () => {
    const html = renderToStaticMarkup(<Provider><span>Application content</span></Provider>);
    expect(html).toContain('<span>Application content</span>');
    expect(html).toContain('--chakra-colors-transport-text');
    expect(html).toContain('--chakra-colors-surface-sheet');
    expect(html).toContain('--chakra-colors-surface-plate');
    expect(html).toContain('--chakra-colors-interaction-accent');
  });
});
