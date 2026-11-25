import { describe, expect, it } from 'vitest';

import { GenerateImageSchema, ImageContextIRRequestSchema } from './ImageDTO';

const JPEG_DATA_URL = `data:image/jpeg;base64,${Buffer.from('portrait').toString('base64')}`;
const PNG_DATA_URL = `data:image/png;base64,${Buffer.from('portrait').toString('base64')}`;

describe('GenerateImageSchema', () => {
  it('defaults to the MiniMax-H3-Image text-to-image contract', () => {
    const result = GenerateImageSchema.safeParse({ prompt: 'A premium product photo.' });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.model).toBe('MiniMax-H3-Image');
    expect(result.data.n).toBe(1);
    expect(result.data.outputFormat).toBe('jpeg');
    expect(result.data.responseFormat).toBe('url');
    expect(result.data.outputCompression).toBe(95);
    expect(result.data.disablePromptEnhanced).toBe(false);
    expect(result.data.stream).toBe(false);
    expect(result.data.size).toBeUndefined();
    expect(result.data.aspectRatio).toBeUndefined();
    expect(result.data.area).toBeUndefined();
    expect(result.data.images).toBeUndefined();
  });

  it('rejects legacy image-01 options instead of ignoring them', () => {
    const seedResult = GenerateImageSchema.safeParse({ prompt: 'A photo.', seed: 42 });
    expect(seedResult.success).toBe(false);
    if (!seedResult.success) {
      expect(seedResult.error.issues[0]?.message).toContain('seed');
    }

    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', promptOptimizer: true }).success).toBe(false);
    expect(GenerateImageSchema.safeParse({
      prompt: 'A photo.',
      subjectReference: [{ type: 'character', imageFile: JPEG_DATA_URL }],
    }).success).toBe(false);
  });

  it('accepts only the supported image models', () => {
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', model: 'MiniMax-H3-Image' }).success).toBe(true);
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', model: 'MiniMax-H3-Image-Highspeed' }).success).toBe(true);
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', model: 'image-01' }).success).toBe(false);
  });

  it('accepts documented aspect ratios and rejects out-of-range ratios', () => {
    for (const aspectRatio of ['auto', '1:1', '16:9', '3:1', '1:3', '21:9', '9:16']) {
      expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', aspectRatio }).success).toBe(true);
    }
    for (const aspectRatio of ['1:4', '4:1', '0:1', '301:1', 'abc', '16-9', '16:']) {
      expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', aspectRatio }).success).toBe(false);
    }
  });

  it('accepts documented area levels only', () => {
    for (const area of ['1K', '2K', '4K']) {
      expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', area }).success).toBe(true);
    }
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', area: '8K' }).success).toBe(false);
  });

  it('validates explicit width x height sizes', () => {
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', size: '2720x1536' }).success).toBe(true);
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', size: '2048x2048' }).success).toBe(true);
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', size: 'auto' }).success).toBe(true);
    // Aspect ratio above 3:1.
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', size: '4096x1024' }).success).toBe(false);
    // Area below 655,360 px.
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', size: '512x512' }).success).toBe(false);
    // Area above 20,000,000 px.
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', size: '8000x8000' }).success).toBe(false);
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', size: '0x100' }).success).toBe(false);
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', size: '1024' }).success).toBe(false);
  });

  it('rejects combining an explicit size with aspect ratio or area', () => {
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', size: '2720x1536', aspectRatio: '16:9' }).success).toBe(false);
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', size: '2720x1536', area: '2K' }).success).toBe(false);
  });

  it('bounds the image count and the output compression', () => {
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', n: 10 }).success).toBe(true);
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', n: 11 }).success).toBe(false);
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', n: 0 }).success).toBe(false);
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', n: 1.5 }).success).toBe(false);
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', outputCompression: 0 }).success).toBe(true);
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', outputCompression: 100 }).success).toBe(true);
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', outputCompression: 101 }).success).toBe(false);
  });

  it('accepts between 1 and 16 reference images from documented sources', () => {
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', images: [{ imageUrl: JPEG_DATA_URL }] }).success).toBe(true);
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', images: [{ imageUrl: 'https://example.com/cat.jpg' }] }).success).toBe(true);
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', images: [{ imageUrl: 'mm_file://file-123' }] }).success).toBe(true);

    const references = Array.from({ length: 16 }, () => ({ imageUrl: PNG_DATA_URL }));
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', images: references }).success).toBe(true);
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', images: [...references, { imageUrl: PNG_DATA_URL }] }).success).toBe(false);
  });

  it('rejects unsupported reference image sources', () => {
    expect(GenerateImageSchema.safeParse({
      prompt: 'A photo.',
      images: [{ imageUrl: `data:image/gif;base64,${Buffer.from('x').toString('base64')}` }],
    }).success).toBe(false);
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', images: [{ imageUrl: 'ftp://example.com/cat.jpg' }] }).success).toBe(false);
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', images: [{ imageUrl: '' }] }).success).toBe(false);
  });

  it('requires a fixed ratio or an explicit size when prompt enhancement is disabled', () => {
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', disablePromptEnhanced: true }).success).toBe(false);
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', disablePromptEnhanced: true, aspectRatio: '16:9' }).success).toBe(true);
    expect(GenerateImageSchema.safeParse({ prompt: 'A photo.', disablePromptEnhanced: true, size: '2720x1536' }).success).toBe(true);
  });

  it('refuses to disable prompt enhancement for image edits', () => {
    expect(GenerateImageSchema.safeParse({
      prompt: 'A photo.',
      images: [{ imageUrl: JPEG_DATA_URL }],
      disablePromptEnhanced: true,
    }).success).toBe(false);
  });

  it('rejects prompts longer than the documented limit', () => {
    expect(GenerateImageSchema.safeParse({ prompt: 'a'.repeat(32_000) }).success).toBe(true);
    expect(GenerateImageSchema.safeParse({ prompt: 'a'.repeat(32_001) }).success).toBe(false);
    expect(GenerateImageSchema.safeParse({ prompt: '   ' }).success).toBe(false);
  });
});

describe('ImageContextIRRequestSchema', () => {
  it('only accepts the MiniMax-H3-Image model', () => {
    const result = ImageContextIRRequestSchema.safeParse({ prompt: 'A photo.' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.model).toBe('MiniMax-H3-Image');
    expect(ImageContextIRRequestSchema.safeParse({ prompt: 'A photo.', model: 'MiniMax-H3-Image-Highspeed' }).success).toBe(false);
  });

  it('rejects combining an explicit size with aspect ratio or area', () => {
    expect(ImageContextIRRequestSchema.safeParse({ prompt: 'A photo.', size: '2720x1536', aspectRatio: '16:9' }).success).toBe(false);
    expect(ImageContextIRRequestSchema.safeParse({ prompt: 'A photo.', size: '2720x1536', area: '2K' }).success).toBe(false);
    expect(ImageContextIRRequestSchema.safeParse({ prompt: 'A photo.', aspectRatio: '16:9', area: '2K' }).success).toBe(true);
  });

  it('accepts reference images for image-edit enhancement', () => {
    expect(ImageContextIRRequestSchema.safeParse({
      prompt: 'A photo.',
      images: [{ imageUrl: JPEG_DATA_URL }],
    }).success).toBe(true);
  });
});

describe('GenerateImageSchema', () => {
  const referenceImageDataUrl = `data:image/jpeg;base64,${Buffer.from('portrait').toString('base64')}`;

  it('accepts a minimal image generation request with safe defaults', () => {
    const result = GenerateImageSchema.safeParse({
      prompt: 'A premium product photo of a green glass speaker on marble.',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model).toBe('MiniMax-H3-Image');
      expect(result.data.aspectRatio).toBeUndefined();
      expect(result.data.responseFormat).toBe('url');
      expect(result.data.n).toBe(1);
      expect(result.data.disablePromptEnhanced).toBe(false);
    }
  });

  it('accepts documented aspect ratios and image count bounds', () => {
    const result = GenerateImageSchema.safeParse({
      prompt: 'A cinematic landscape with soft sunrise lighting.',
      aspectRatio: '21:9',
      n: 9,
      disablePromptEnhanced: true,
    });

    expect(result.success).toBe(true);
  });

  it('accepts an H3 image edit reference Data URL', () => {
    const result = GenerateImageSchema.safeParse({
      prompt: 'Create an editorial portrait with soft studio lighting.',
      images: [{ imageUrl: referenceImageDataUrl }],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.images).toEqual([{ imageUrl: referenceImageDataUrl }]);
    }
  });

  it('rejects invalid or unsupported legacy image reference inputs', () => {
    expect(GenerateImageSchema.safeParse({
      prompt: 'test',
      images: [{ imageUrl: 'javascript:alert(1)' }],
    }).success).toBe(false);
    expect(GenerateImageSchema.safeParse({
      prompt: 'test',
      images: [{ imageUrl: `data:image/gif;base64,${Buffer.from('portrait').toString('base64')}` }],
    }).success).toBe(false);
    expect(GenerateImageSchema.safeParse({
      prompt: 'test',
      subjectReference: [{ type: 'product', imageFile: referenceImageDataUrl }],
    }).success).toBe(false);
    expect(GenerateImageSchema.safeParse({
      prompt: 'test',
      images: [],
    }).success).toBe(false);
  });


  it('rejects prompts exceeding 32,000 characters', () => {
    const result = GenerateImageSchema.safeParse({
      prompt: 'a'.repeat(32001),
    });

    expect(result.success).toBe(false);
  });

  it('rejects unsupported base64 output because the app stores URL Library items', () => {
    const result = GenerateImageSchema.safeParse({
      prompt: 'A premium product photo.',
      responseFormat: 'base64',
    });

    expect(result.success).toBe(false);
  });

  it('validates the H3 size format and rejects obsolete dimension properties', () => {
    expect(GenerateImageSchema.safeParse({ prompt: 'test', width: 1024 }).success).toBe(false);
    expect(GenerateImageSchema.safeParse({ prompt: 'test', width: 1025, height: 1024 }).success).toBe(false);
    expect(GenerateImageSchema.safeParse({ prompt: 'test', size: '1024x1024' }).success).toBe(true);
    expect(GenerateImageSchema.safeParse({ prompt: 'test', size: '1024x1024', aspectRatio: '1:1' }).success).toBe(false);
  });
});
