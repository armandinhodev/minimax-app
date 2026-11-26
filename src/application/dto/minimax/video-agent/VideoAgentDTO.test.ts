/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import {
  CreateVideoAgentTaskSchema,
  findVideoAgentTemplate,
  normalizeVideoAgentStatus,
  validateTemplateMediaReference,
  VIDEO_AGENT_TEMPLATES,
} from './VideoAgentDTO';

const DIVE_ID = '392747428568649728';
const ANIME_ID = '394514820878671878';

describe('VIDEO_AGENT_TEMPLATES', () => {
  it('ships the official catalogue with unique ids', () => {
    expect(VIDEO_AGENT_TEMPLATES.length).toBe(16);

    const ids = VIDEO_AGENT_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('marks which templates need media and which need text', () => {
    expect(findVideoAgentTemplate(DIVE_ID)).toMatchObject({
      name: 'Diving',
      requiresMedia: true,
      requiresText: false,
    });
    expect(findVideoAgentTemplate(ANIME_ID)).toMatchObject({
      name: 'Anime Life Sim',
      requiresMedia: false,
      requiresText: true,
    });
  });
});

describe('CreateVideoAgentTaskSchema', () => {
  it('accepts a template with its required inputs', () => {
    const parsed = CreateVideoAgentTaskSchema.safeParse({
      templateId: DIVE_ID,
      mediaInputs: [{ value: 'https://example.com/a.jpg' }],
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects an unknown template', () => {
    const parsed = CreateVideoAgentTaskSchema.safeParse({ templateId: '123' });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((issue) => issue.message).join(' ')).toContain('Unknown template ID');
    }
  });

  it('requires the media input when the template needs one', () => {
    const parsed = CreateVideoAgentTaskSchema.safeParse({ templateId: DIVE_ID });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((issue) => issue.message).join(' ')).toContain('needs a media input');
    }
  });

  it('requires the text input when the template needs one', () => {
    const parsed = CreateVideoAgentTaskSchema.safeParse({ templateId: ANIME_ID });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((issue) => issue.message).join(' ')).toContain('needs a text input');
    }
  });

  it('rejects a media reference that is not a URL or a data URL', () => {
    const parsed = CreateVideoAgentTaskSchema.safeParse({
      templateId: DIVE_ID,
      mediaInputs: [{ value: 'not-a-url' }],
    });

    expect(parsed.success).toBe(false);
  });
});

describe('validateTemplateMediaReference', () => {
  it('accepts public URLs, mm_file references and supported data URLs', () => {
    expect(validateTemplateMediaReference('https://example.com/a.jpg')).toBeNull();
    expect(validateTemplateMediaReference('http://example.com/a.png')).toBeNull();
    expect(validateTemplateMediaReference('mm_file://123456')).toBeNull();
    expect(validateTemplateMediaReference('data:image/png;base64,aGVsbG8=')).toBeNull();
  });

  it('rejects an empty reference', () => {
    expect(validateTemplateMediaReference('  ')).toContain('required');
  });

  it('rejects unsupported formats and credentials', () => {
    expect(validateTemplateMediaReference('data:image/gif;base64,aGVsbG8=')).toContain('JPEG, PNG or WebP');
    expect(validateTemplateMediaReference('https://user:pass@example.com/a.jpg')).toContain('credentials');
  });
});

describe('normalizeVideoAgentStatus', () => {
  it('maps the upstream vocabulary to the app one', () => {
    expect(normalizeVideoAgentStatus('Preparing')).toBe('preparing');
    expect(normalizeVideoAgentStatus('Processing')).toBe('processing');
    expect(normalizeVideoAgentStatus('Success')).toBe('succeeded');
    expect(normalizeVideoAgentStatus('Fail')).toBe('failed');
  });

  it('falls back to processing for an unknown status', () => {
    expect(normalizeVideoAgentStatus('whatever')).toBe('processing');
    expect(normalizeVideoAgentStatus(undefined)).toBe('processing');
  });
});
