/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { executeMock } = vi.hoisted(() => ({
  executeMock: vi.fn(),
}));

const { recordGenerationBestEffortMock } = vi.hoisted(() => ({
  recordGenerationBestEffortMock: vi.fn(),
}));

vi.mock('@/application/use-cases/minimax/image/GenerateImage', () => ({
  GenerateImageUseCase: vi.fn().mockImplementation(() => ({
    execute: executeMock,
  })),
  GenerateImageValidationError: class GenerateImageValidationError extends Error {},
}));

vi.mock('../_shared/library-recording', () => ({
  recordGenerationBestEffort: recordGenerationBestEffortMock,
}));

const GENERATION_RESULT = {
  id: 'req-1',
  imageUrls: ['https://example.com/out-0.jpg'],
  images: [
    {
      index: 0,
      url: 'https://example.com/out-0.jpg',
      size: '2720x1536',
      revisedPrompt: 'An enhanced prompt.',
      error: null,
    },
  ],
  metadata: {
    successCount: 1,
    failedCount: 0,
    totalCount: 1,
    outputFormat: 'jpeg',
    requestId: 'req-1',
    created: 1792308678,
    usage: null,
  },
  expiresAt: null,
};

function imageRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/minimax/image', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer test-key',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/minimax/image', () => {
  beforeEach(() => {
    process.env.APP_ACCESS_KEY = 'test-key';
    process.env.MINIMAX_API_KEY = 'test-minimax-key';
    executeMock.mockReset();
    recordGenerationBestEffortMock.mockReset();
    recordGenerationBestEffortMock.mockReturnValue(null);
  });

  it('requires app authentication', async () => {
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'A photo.' }),
    }));

    expect(response.status).toBe(401);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('validates and returns generated image URLs', async () => {
    const { POST } = await import('./route');
    executeMock.mockResolvedValue(GENERATION_RESULT);

    const response = await POST(imageRequest({
      prompt: 'A polished product photo.',
      aspectRatio: '16:9',
      area: '2K',
      n: 2,
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(GENERATION_RESULT);
    expect(executeMock).toHaveBeenCalledWith(expect.objectContaining({
      model: 'MiniMax-H3-Image',
      prompt: 'A polished product photo.',
      aspectRatio: '16:9',
      area: '2K',
      n: 2,
      outputFormat: 'jpeg',
      responseFormat: 'url',
      disablePromptEnhanced: false,
    }));
  });

  it('rejects the legacy image-01 seed option instead of ignoring it', async () => {
    const { POST } = await import('./route');

    const response = await POST(imageRequest({ prompt: 'A polished product photo.', seed: 42 }));

    expect(response.status).toBe(400);
    expect(executeMock).not.toHaveBeenCalled();
    expect(recordGenerationBestEffortMock).not.toHaveBeenCalled();
  });

  it('rejects invalid image requests before calling MiniMax', async () => {
    const { POST } = await import('./route');

    const response = await POST(imageRequest({ prompt: '', n: 10 }));

    expect(response.status).toBe(400);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('rejects a malformed JSON body before calling MiniMax', async () => {
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/image', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-key',
        'Content-Type': 'application/json',
      },
      body: '{not-json',
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON body' });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('keeps the shared retryable response for upstream server failures', async () => {
    const { POST } = await import('./route');
    const { MiniMaxImageError } = await import('@/infrastructure/minimax/image/ImageClient');
    executeMock.mockRejectedValue(new MiniMaxImageError('internal error (1000)', 500, 500));

    const response = await POST(imageRequest({ prompt: 'A polished product photo.' }));

    expect(response.status).toBe(503);
    const body = await response.json() as { error: string; code: number; retryable: boolean };
    expect(body.code).toBe(500);
    expect(body.retryable).toBe(true);
    expect(body.error).toContain('temporarily unavailable');
  });

  it('records a text-to-image generation with the provider output format', async () => {
    const { POST } = await import('./route');
    executeMock.mockResolvedValue(GENERATION_RESULT);

    await POST(imageRequest({ prompt: 'A polished product photo.', aspectRatio: '16:9', area: '2K' }));

    expect(recordGenerationBestEffortMock).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'image',
      source: 'text-to-image',
      model: 'MiniMax-H3-Image',
      providerGenerationId: 'req-1',
      assets: [expect.objectContaining({
        kind: 'image',
        storageType: 'provider_url',
        storageRef: 'https://example.com/out-0.jpg',
        format: 'jpeg',
        mimeType: 'image/jpeg',
        expiresAt: null,
      })],
    }));
  });

  it('records an image-to-image generation when reference images are used', async () => {
    const { POST } = await import('./route');
    executeMock.mockResolvedValue(GENERATION_RESULT);
    const referenceImageDataUrl = `data:image/png;base64,${Buffer.from('portrait').toString('base64')}`;

    await POST(imageRequest({
      prompt: 'Create an editorial portrait.',
      images: [{ imageUrl: referenceImageDataUrl }],
    }));

    expect(recordGenerationBestEffortMock).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'image',
      source: 'image-to-image',
    }));
  });

  it('surfaces provider validation errors with the upstream status and message', async () => {
    const { POST } = await import('./route');
    const { MiniMaxImageError } = await import('@/infrastructure/minimax/image/ImageClient');
    executeMock.mockRejectedValue(new MiniMaxImageError(
      'invalid params, size 4096x1024: aspect ratio must be within 1:3 and 3:1 (2013)',
      400,
      400,
    ));

    const response = await POST(imageRequest({ prompt: 'A polished product photo.' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'invalid params, size 4096x1024: aspect ratio must be within 1:3 and 3:1 (2013)',
      code: 400,
    });
    expect(recordGenerationBestEffortMock).not.toHaveBeenCalled();
  });
});
