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
 * A line may opt out with `// copy-test:allow` when the rule is wrong for
 * that line. The opt out is a comment, so it survives a review.
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

/**
 * The rail lists feature names, not sentences: "Clone Voice" keeps its
 * title case there and the button that clones a voice says "Clone voice".
 */
const SENTENCE_CASE_EXEMPT = ['src/components/navigation/nav-config.ts'];

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
  'DialogTitle',
  // A tab names a control, like a button. It is not the rail, so it does not
  // get the rail's title-case exemption.
  'TabsTrigger',
  'Text',
  'Heading',
  'p',
];

/**
 * Names of the domain that are proper nouns, not title case.
 *
 * A candidate that contains one of these is exempt: "Web Audio API" and
 * "Cover Preprocess" are names, not sentences.
 */
const PROPER_NOUNS = [
  'MiniMax',
  'Hailuo',
  'Library',
  'Cover Preprocess',
  'Web Audio',
  'H3',
  'M3',
  'TTS',
  'ASR',
  'MP3',
  'WAV',
  'AAC',
  'FLAC',
  'MIDI',
  'URL',
  'URI',
  'API',
  'SSE',
  'HTTP',
  'ID',
  'TTL',
  'SQL',
  'JSON',
  'CSV',
  'PNG',
  'JPEG',
  'WebP',
  'HEIC',
  'HEIF',
  'SVG',
  'BPM',
  'FPS',
  'HDR',
  'DPI',
  'GPU',
  'CPU',
  'UI',
  'OAuth',
  'JWT',
  'XML',
  'YAML',
  'EXIF',
  'VOD',
  'LLM',
];

function containsProperNoun(text: string): boolean {
  return PROPER_NOUNS.some((noun) => new RegExp(`\\b${noun}\\b`).test(text));
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) out.push(full);
  }
  return out;
}

function allFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) allFiles(full, out);
    else if (!entry.name.includes('.test.')) out.push(full);
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

/** The whole source tree, for the rules that are not about copy. */
const TREE = existsSync(path.join(ROOT, 'src'))
  ? allFiles(path.join(ROOT, 'src')).map((file) => ({
      file: file.replace(/\\/g, '/').replace(`${ROOT.replace(/\\/g, '/')}/`, ''),
      content: readFileSync(file, 'utf8'),
    }))
  : [];

/**
 * Comments carry no copy.
 *
 * A block comment keeps its newlines, so the line numbers still line up with
 * the original file: an opt-out comment is matched against them.
 */
function stripComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((line) => (line.trim().startsWith('//') ? '' : line))
    .join('\n');
}

/** A line that opts out of a rule. */
function isExempt(content: string, index: number): boolean {
  const lines = content.split('\n');
  const current = lines[index] ?? '';
  const previous = lines[index - 1] ?? '';
  return current.includes('copy-test:allow') || previous.includes('copy-test:allow');
}

/** An acronym, a camelCase name, a hyphenated name or a domain name. */
function isProperNoun(word: string): boolean {
  const clean = word.replace(/[.,;:!?]+$/, '');
  if (PROPER_NOUNS.includes(clean)) return true;
  return (
    /[a-z][A-Z]/.test(clean) || // MiniMax
    /^[A-Z0-9]+$/.test(clean) || // URL, MP3
    /-$/.test(clean) // H3-
  );
}

/**
 * Sentence case: two capitalised words in a row, unless one of them is a
 * name of the domain.
 */
function isTitleCase(text: string, allowSentence: boolean): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  if (allowSentence && /[.!?]/.test(trimmed)) return false;
  if (trimmed === trimmed.toUpperCase()) return false;
  if (containsProperNoun(trimmed)) return false;

  const words = trimmed.split(/\s+/).map((word) => word.replace(/[.,;:!?]+$/, ''));

  for (let index = 1; index < words.length; index += 1) {
    const word = words[index];
    const previous = words[index - 1];
    if (!/^[A-Z][a-z]/.test(word)) continue;
    if (!/^[A-Z][a-z]/.test(previous)) continue;
    if (isProperNoun(word) || isProperNoun(previous)) continue;
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
    // The end of the opening tag: a '>' inside an attribute value or an
    // arrow function does not end it.
    let openEnd = -1;
    let quote: string | null = null;
    let braceDepth = 0;
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
      if (char === '{') {
        braceDepth += 1;
        continue;
      }
      if (char === '}') {
        braceDepth -= 1;
        continue;
      }
      if (char === '>' && braceDepth === 0) {
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

/** Every string the user can read, with the line it lives on. */
function visibleStrings(): Array<{ file: string; text: string; line: number }> {
  const found: Array<{ file: string; text: string; line: number }> = [];

  for (const { file, content } of FILES) {
    const lineOf = (index: number) => content.slice(0, index).split('\n').length;

    for (const tag of VISIBLE_TAGS) {
      for (const inner of innerOf(content, tag)) {
        for (const candidate of candidates(inner)) {
          found.push({ file, text: candidate, line: 0 });
        }
      }
    }

    // Attributes that carry copy the user reads.
    const attributes = /(?:label|placeholder|aria-label|title)="([^"]+)"/g;
    for (const match of content.matchAll(attributes)) {
      found.push({ file, text: match[1], line: lineOf(match.index) });
    }

    // Toasts: where the state messages live.
    for (const match of content.matchAll(/toast\s*\(([\s\S]{0,400}?)\)/g)) {
      for (const candidate of candidates(match[1])) {
        found.push({ file, text: candidate, line: lineOf(match.index) });
      }
    }

    for (const match of content.matchAll(/<Field[^>]*label="([^"]*)"/g)) {
      found.push({ file, text: match[1], line: lineOf(match.index) });
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
    // A sentinel: a file that must be there for the scan to mean anything.
    expect(FILES.some((file) => file.file.endsWith('src/app/(app)/library/page.tsx'))).toBe(true);
  });

  it('never marks a field label as optional or required', () => {
    const marker = /\((optional|required|opt|req)\)|\*/i;
    const bare = /\b(optional|required)\b/i;
    const offenders: string[] = [];

    for (const { file, content } of FILES) {
      for (const match of content.matchAll(/<Field[^>]*label="([^"]*)"/g)) {
        if (marker.test(match[1]) || bare.test(match[1])) {
          offenders.push(`${file}: "${match[1]}"`);
        }
      }
      for (const inner of innerOf(content, 'Label')) {
        for (const candidate of candidates(inner)) {
          if (marker.test(candidate) || bare.test(candidate)) {
            offenders.push(`${file}: <Label> "${candidate}"`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps labels, panel titles and button labels in sentence case', () => {
    const offenders: string[] = [];

    for (const { file, content } of FILES) {
      if (SENTENCE_CASE_EXEMPT.includes(file)) continue;

      for (const tag of VISIBLE_TAGS) {
        // A description, a title or a paragraph can be a sentence: it ends
        // with a period. A button label never is.
        const allowSentence = tag !== 'Button';
        for (const inner of innerOf(content, tag)) {
          for (const candidate of candidates(inner)) {
            if (isTitleCase(candidate, allowSentence)) {
              offenders.push(`${file}: <${tag}> "${candidate}"`);
            }
          }
        }
      }

      for (const match of content.matchAll(/<Field[^>]*label="([^"]*)"/g)) {
        if (isTitleCase(match[1], false)) offenders.push(`${file}: "${match[1]}"`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('never joins values with a middle dot', () => {
    const offenders: string[] = [];

    for (const { file, content } of FILES) {
      stripComments(content)
        .split('\n')
        .forEach((line, index) => {
          if (!/[·•‧]/.test(line)) return;
          if (isExempt(content, index)) return;
          offenders.push(`${file}:${index + 1}: ${line.trim()}`);
        });
    }

    expect(offenders).toEqual([]);
  });

  it('never talks about the implementation in what the user reads', () => {
    const jargon = /\b(backend|SQLite|HTTP|REST API)\b/;
    const offenders: string[] = [];

    for (const { file, text, line } of visibleStrings()) {
      if (!jargon.test(text)) continue;
      if (line > 0 && isExempt(FILES.find((f) => f.file === file)?.content ?? '', line)) continue;
      offenders.push(`${file}: "${text}"`);
    }

    expect(offenders).toEqual([]);
  });

  it('never labels a value inside a sentence', () => {
    // "Format: MP3" and "Duration: 165s" are a value wearing a sentence.
    // A long text with a period is a sentence, not a label.
    const meta = /^[A-Z][a-z]+:\s+\S/;
    const offenders: string[] = [];

    for (const { file, text, line } of visibleStrings()) {
      if (text.length > 40) continue;
      if (/[.!?]/.test(text)) continue;
      if (text.includes('://')) continue;
      if (/[`${}]/.test(text)) continue;
      if (!meta.test(text)) continue;
      if (line > 0 && isExempt(FILES.find((f) => f.file === file)?.content ?? '', line)) continue;
      offenders.push(`${file}: "${text}"`);
    }

    expect(offenders).toEqual([]);
  });
});

describe('token rules', () => {
  it('only uses color tokens the theme defines', () => {
    const offenders: string[] = [];

    for (const { file, content } of FILES) {
      const pattern = /(?:color|bg|backgroundColor|borderColor|fill|borderTopColor|borderLeftColor|borderBottomColor|borderRightColor|outlineColor|caretColor|textDecorationColor)="([a-zA-Z]+\.[a-zA-Z]+)"/g;
      for (const match of content.matchAll(pattern)) {
        // The token must resolve in the color space, not only exist as a name.
        const value = system.token(`colors.${match[1]}`);
        if (value === undefined || value === null) offenders.push(`${file}: "${match[1]}"`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('only references CSS variables that exist', () => {
    const known = system.tokens.cssVarMap.get('base');
    const offenders: string[] = [];

    // A stylesheet may declare its own variables; those exist by definition.
    const declared = new Set<string>();
    for (const { content } of TREE) {
      if (!content.includes('--')) continue;
      for (const match of content.matchAll(/^\s*(--[a-zA-Z0-9-]+)\s*:/gm)) {
        declared.add(match[1]);
      }
    }

    for (const { file, content } of TREE) {
      for (const match of content.matchAll(/var\((--[a-zA-Z0-9-]+)\)/g)) {
        // The two font variables come from next/font, the rest from the theme.
        if (match[1] === '--font-archivo' || match[1] === '--font-plex-mono') continue;
        if (declared.has(match[1])) continue;
        if (!known?.has(match[1])) offenders.push(`${file}: ${match[1]}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('never reaches for the raw palette instead of a semantic token', () => {
    // "transparent" is a CSS keyword, not a colour of the palette.
    const raw = /["']((?:red|blue|green|yellow|orange|purple|pink|cyan|teal|gray|grey|black|white|whiteAlpha|blackAlpha)\.\d{2,3}|white|black)["']/;
    const offenders: string[] = [];

    for (const { file, content } of FILES) {
      const lines = stripComments(content).split('\n');
      lines.forEach((line, index) => {
        if (!raw.test(line)) return;
        if (isExempt(content, index)) return;
        offenders.push(`${file}:${index + 1}: ${line.trim()}`);
      });
    }

    expect(offenders).toEqual([]);
  });
});
