// @vitest-environment node

/**
 * Copy and consistency rules.
 *
 * The design system is only worth something if its rules survive the next
 * change. These tests read the source tree and fail when a rule is broken,
 * the same way theme.test.tsx guards the color tokens.
 *
 * The root is resolved from this file, not from the working directory, so
 * the scan cannot silently find nothing. A scan that finds nothing is a
 * test that protects nothing, and the first test here says so out loud.
 *
 * See docs/design.md.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { system } from './theme';

/** The repository root, resolved from this file. */
const ROOT = path.resolve(__dirname, '..', '..', '..');

const SCAN_DIRS = ['src/app', 'src/components'];

/** Elements whose content the user reads. */
const VISIBLE_TAGS = [
  'SheetTitle',
  'SheetDescription',
  'Button',
  'Label',
  'Alert',
  'AlertTitle',
  'AlertDescription',
  'Badge',
  'p',
];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) out.push(full);
  }
  return out;
}

const FILES = SCAN_DIRS.flatMap((dir) => {
  const absolute = path.join(ROOT, dir);
  if (!existsSync(absolute)) return [];
  return sourceFiles(absolute);
}).map((file) => ({
  file: file.replace(/\\/g, '/').replace(`${ROOT.replace(/\\/g, '/')}/`, ''),
  content: readFileSync(file, 'utf8'),
}));

/** A candidate that is a sentence, not a title, is not title case. */
function isSentence(text: string): boolean {
  return /[.!?]/.test(text);
}

/** An acronym, a camelCase name or a hyphenated name is a proper noun. */
function isProperNoun(word: string): boolean {
  return (
    /[a-z][A-Z]/.test(word) || // MiniMax
    /^[A-Z0-9]+$/.test(word) || // URL, MP3
    /-$/.test(word) // H3-
  );
}

function isTitleCase(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  if (isSentence(trimmed)) return false;
  if (trimmed === trimmed.toUpperCase()) return false;

  const words = trimmed.split(/\s+/);
  for (let index = 1; index < words.length; index += 1) {
    const word = words[index].replace(/[.,;:!?]+$/, '');
    if (!/^[A-Z][a-z]/.test(word)) continue;
    if (isProperNoun(word)) continue;
    if (isProperNoun(words[index - 1])) continue;
    return true;
  }

  return false;
}

/** The inner content of a JSX element, matched by its closing tag. */
function innerOf(content: string, tag: string): string[] {
  const results: string[] = [];
  const open = new RegExp(`<${tag}(\\s|>)`, 'g');
  let match: RegExpExecArray | null;

  while ((match = open.exec(content)) !== null) {
    // The end of the opening tag: a '>' inside an attribute value does not end it.
    let openEnd = -1;
    let quote: string | null = null;
    for (let i = match.index; i < content.length; i += 1) {
      const char = content[i];
      if (quote !== null) {
        if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        continue;
      }
      if (char === '>') {
        openEnd = i;
        break;
      }
    }
    if (openEnd === -1) continue;

    // The matching close tag, counting nesting.
    const scan = new RegExp(`<${tag}(\\s|>)|</${tag}>`, 'g');
    scan.lastIndex = openEnd + 1;
    let depth = 1;
    let close = -1;
    let step: RegExpExecArray | null;
    while ((step = scan.exec(content)) !== null) {
      if (step[0].startsWith('</')) {
        depth -= 1;
        if (depth === 0) {
          close = step.index;
          break;
        }
      } else {
        depth += 1;
      }
    }
    if (close === -1) continue;

    results.push(content.slice(openEnd + 1, close));
    open.lastIndex = close;
  }

  return results;
}

/** The text candidates of a chunk of JSX: quoted literals plus plain text. */
function candidates(inner: string): string[] {
  const found: string[] = [];

  for (const match of inner.matchAll(/"([^"]*)"|'([^']*)'/g)) {
    const value = match[1] ?? match[2] ?? '';
    if (value) found.push(value);
  }

  const plain = inner
    .replace(/\{[\s\S]*?\}/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain) found.push(plain);

  return found;
}

/** Every string the user can read. */
function visibleStrings(): Array<{ file: string; text: string }> {
  const found: Array<{ file: string; text: string }> = [];

  for (const { file, content } of FILES) {
    for (const tag of VISIBLE_TAGS) {
      for (const inner of innerOf(content, tag)) {
        for (const candidate of candidates(inner)) {
          found.push({ file, text: candidate });
        }
      }
    }
    for (const match of content.matchAll(/<Field[^>]*label="([^"]*)"/g)) {
      found.push({ file, text: match[1] });
    }
  }

  return found;
}

describe('copy rules', () => {
  it('scans the source tree instead of passing on nothing', () => {
    for (const dir of SCAN_DIRS) {
      expect(existsSync(path.join(ROOT, dir)), `${dir} does not exist under ${ROOT}`).toBe(true);
    }
    expect(FILES.length).toBeGreaterThan(40);
  });

  it('never marks a field label as optional or required', () => {
    const marker = /\((optional|required|opt|req)\)|\*/i;
    const offenders: string[] = [];

    for (const { file, content } of FILES) {
      for (const match of content.matchAll(/<Field[^>]*label="([^"]*)"/g)) {
        if (marker.test(match[1])) offenders.push(`${file}: "${match[1]}"`);
      }
      for (const inner of innerOf(content, 'Label')) {
        for (const candidate of candidates(inner)) {
          if (marker.test(candidate)) offenders.push(`${file}: <Label> "${candidate}"`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps labels, panel titles and button labels in sentence case', () => {
    const offenders: string[] = [];

    for (const { file, content } of FILES) {
      for (const tag of ['SheetTitle', 'Button', 'SheetDescription', 'Label']) {
        for (const inner of innerOf(content, tag)) {
          for (const candidate of candidates(inner)) {
            if (isTitleCase(candidate)) offenders.push(`${file}: <${tag}> "${candidate}"`);
          }
        }
      }
      for (const match of content.matchAll(/<Field[^>]*label="([^"]*)"/g)) {
        if (isTitleCase(match[1])) offenders.push(`${file}: "${match[1]}"`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('never joins values with a middle dot', () => {
    const offenders: string[] = [];

    for (const { file, content } of FILES) {
      content.split('\n').forEach((line, index) => {
        if (/[·•‧]/.test(line)) offenders.push(`${file}:${index + 1}: ${line.trim()}`);
      });
    }

    expect(offenders).toEqual([]);
  });

  it('never talks about the implementation in what the user reads', () => {
    const jargon = /\b(backend|SQLite|HTTP|REST API)\b/;
    const offenders: string[] = [];

    for (const { file, text } of visibleStrings()) {
      if (jargon.test(text)) offenders.push(`${file}: "${text}"`);
    }

    expect(offenders).toEqual([]);
  });
});

describe('token rules', () => {
  it('only uses color tokens the theme defines', () => {
    const known = system.tokens.cssVarMap.get('base');
    const offenders: string[] = [];

    for (const { file, content } of FILES) {
      const pattern = /(?:color|bg|backgroundColor|borderColor|fill)="([a-zA-Z]+\.[a-zA-Z]+)"/g;
      for (const match of content.matchAll(pattern)) {
        // Chakra dashes the token path: state.okSoft -> state-ok-soft.
        const variable = `--chakra-colors-${match[1]
          .split('.')
          .map((part) => part.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase())
          .join('-')}`;
        if (!known?.has(variable)) offenders.push(`${file}: "${match[1]}"`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('only references CSS variables that exist', () => {
    const known = system.tokens.cssVarMap.get('base');
    const offenders: string[] = [];

    for (const { file, content } of FILES) {
      for (const match of content.matchAll(/var\((--[a-zA-Z0-9-]+)\)/g)) {
        // The font variables come from next/font, the rest from the theme.
        if (match[1].startsWith('--font-')) continue;
        if (!known?.has(match[1])) offenders.push(`${file}: ${match[1]}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('never reaches for the raw palette instead of a semantic token', () => {
    const raw = /"(red|blue|green|yellow|orange|purple|pink|cyan|teal|gray|grey|black|white|whiteAlpha|blackAlpha)\.\d{2,3}"/g;
    const offenders: string[] = [];

    for (const { file, content } of FILES) {
      for (const match of content.matchAll(raw)) {
        offenders.push(`${file}: ${match[0]}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
