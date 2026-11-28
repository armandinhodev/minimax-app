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
const THREE_D_ID = '401431836934868999';
const ECOMMERCE_ID = '393853165953970178';

describe('VIDEO_AGENT_TEMPLATES', () => {
  it('ships the official catalogue with unique ids', () => {
    expect(VIDEO_AGENT_TEMPLATES.length).toBe(16);

    const ids = VIDEO_AGENT_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('records the exact input counts the provider validates', () => {
    expect(findVideoAgentTemplate(DIVE_ID)).toMatchObject({ requiresMedia: true, requiresText: false, mediaCount: 1 });
    expect(findVideoAgentTemplate(ANIME_ID)).toMatchObject({ requiresMedia: false, requiresText: true, mediaCount: 0 });
    expect(findVideoAgentTemplate(THREE_D_ID)).toMatchObject({ requiresMedia: true, requiresText: true, mediaCount: 3 });
    // The published table omits media and requires text, but the API expects
    // one image and zero text inputs.
    expect(findVideoAgentTemplate(ECOMMERCE_ID)).toMatchObject({ requiresMedia: true, requiresText: false, mediaCount: 1 });
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

  it('requires exactly three images for the 3D character template', () => {
    const image = { value: 'https://example.com/product.png' };
    const missing = CreateVideoAgentTaskSchema.safeParse({
      templateId: THREE_D_ID,
      mediaInputs: [image],
      textInputs: [{ value: 'A friendly character presents the product.' }],
    });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error.issues.map((issue) => issue.message).join(' ')).toContain('exactly 3 images');
    }

    const complete = CreateVideoAgentTaskSchema.safeParse({
      templateId: THREE_D_ID,
      mediaInputs: [image, image, image],
      textInputs: [{ value: 'A friendly character presents the product.' }],
    });
    expect(complete.success).toBe(true);
  });

  it('rejects inputs the provider counts as zero', () => {
    const extraMedia = CreateVideoAgentTaskSchema.safeParse({
      templateId: ANIME_ID,
      mediaInputs: [{ value: 'https://example.com/a.png' }],
      textInputs: [{ value: 'A scene.' }],
    });
    expect(extraMedia.success).toBe(false);

    const extraText = CreateVideoAgentTaskSchema.safeParse({
      templateId: DIVE_ID,
      mediaInputs: [{ value: 'https://example.com/a.png' }],
      textInputs: [{ value: 'Unused text.' }],
    });
    expect(extraText.success).toBe(false);
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
