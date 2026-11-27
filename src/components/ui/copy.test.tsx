// @vitest-environment node

/**
 * Copy and consistency rules.
 *
 * The design system is only worth something if its rules survive the next
 * change. These tests read the source tree and fail when a rule is broken,
 * the same way theme.test.tsx guards the color tokens.
 *
 * See docs/design.md.
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { system } from './theme';

const ROOTS = ['src/app', 'src/components'];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) out.push(full);
  }
  return out;
}

const FILES = ROOTS.flatMap((root) => sourceFiles(root)).map((file) => ({
  file: file.replace(/\\/g, '/'),
  content: readFileSync(file, 'utf8'),
}));

/** Two capitalized words in a row: title case, not sentence case. */
const TITLE_CASE = /(^|\s)([A-Z][a-z]+)\s+([A-Z][a-z]+)(\s|$|[.,;:!?])/;

/** A candidate that is a sentence, not a title, is not title case. */
function isSentence(text: string): boolean {
  return /[.!?]/.test(text);
}

function isTitleCase(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  if (isSentence(trimmed)) return false;
  if (trimmed === trimmed.toUpperCase()) return false;
  return TITLE_CASE.test(trimmed);
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

describe('copy rules', () => {
  it('never marks a field label as optional or required', () => {
    const offenders: string[] = [];

    for (const { file, content } of FILES) {
      for (const match of content.matchAll(/<Field[^>]*label="([^"]*)"/g)) {
        if (/\((optional|required)\)/i.test(match[1])) {
          offenders.push(`${file}: "${match[1]}"`);
        }
      }
      for (const inner of innerOf(content, 'Label')) {
        for (const candidate of candidates(inner)) {
          if (/\((optional|required)\)/i.test(candidate)) {
            offenders.push(`${file}: <Label> "${candidate}"`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps field labels in sentence case', () => {
    const offenders: string[] = [];

    for (const { file, content } of FILES) {
      for (const match of content.matchAll(/<Field[^>]*label="([^"]*)"/g)) {
        if (isTitleCase(match[1])) offenders.push(`${file}: "${match[1]}"`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps panel titles and button labels in sentence case', () => {
    const offenders: string[] = [];

    for (const { file, content } of FILES) {
      for (const tag of ['SheetTitle', 'Button', 'SheetDescription', 'Label']) {
        for (const inner of innerOf(content, tag)) {
          for (const candidate of candidates(inner)) {
            if (isTitleCase(candidate)) {
              offenders.push(`${file}: <${tag}> "${candidate}"`);
            }
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('never joins values with a middle dot', () => {
    const offenders: string[] = [];

    for (const { file, content } of FILES) {
      content.split('\n').forEach((line, index) => {
        if (line.includes('·')) offenders.push(`${file}:${index + 1}: ${line.trim()}`);
      });
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

  it('never reaches for the raw palette instead of a semantic token', () => {
    const semantic = new Set([
      'console',
      'surface',
      'content',
      'interaction',
      'state',
    ]);
    const offenders: string[] = [];

    for (const { file, content } of FILES) {
      const pattern = /"([a-zA-Z]+)\.([a-zA-Z0-9]+)"/g;
      for (const match of content.matchAll(pattern)) {
        const group = match[1];
        if (semantic.has(group)) continue;
        if (!/^(red|gray|blue|green|orange|purple|yellow|cyan|teal|pink)$/.test(group)) continue;
        offenders.push(`${file}: "${match[0]}"`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('only references color variables that exist', () => {
    const known = system.tokens.cssVarMap.get('base');
    const offenders: string[] = [];

    for (const { file, content } of FILES) {
      for (const match of content.matchAll(/var\((--chakra-colors-[^)]+)\)/g)) {
        // A Chakra color variable is dashed: --chakra-colors-content-readout.
        if (!known?.has(match[1])) offenders.push(`${file}: ${match[1]}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
