/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { executeMock } = vi.hoisted(() => ({
  executeMock: vi.fn(),
}));

const { recordGenerationBestEffortMock } = vi.hoisted(() => ({
  recordGenerationBestEffortMock: vi.fn(),
}));

vi.mock('@/application/use-cases/music/PreprocessMusicCover', () => ({
  PreprocessMusicCoverUseCase: vi.fn().mockImplementation(() => ({
    execute: executeMock,
  })),
}));

vi.mock('@/infrastructure/minimax/MiniMaxMusicClient', () => ({
  MiniMaxMusicClient: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../_shared/library-recording', () => ({
  recordGenerationBestEffort: recordGenerationBestEffortMock,
}));

describe('POST /api/minimax/music/cover-preprocess', () => {
  beforeEach(() => {
    process.env.APP_ACCESS_KEY = 'test-key';
    executeMock.mockReset();
    recordGenerationBestEffortMock.mockReset();
    recordGenerationBestEffortMock.mockReturnValue({ id: 'library-cover-preprocess-1' });
  });

  it('validates and returns cover preprocess metadata', async () => {
    const { POST } = await import('./route');
    executeMock.mockResolvedValue({
      coverFeatureId: 'cover-feature-1',
      formattedLyrics: '[Verse]\nCity lights',
      structureResult: '{"sections":["Verse"]}',
      audioDurationSeconds: 42,
      traceId: 'trace-cover-1',
      metadata: { status: 0, message: 'success' },
      coverPreprocessId: 'library-cover-preprocess-1',
    });

    const response = await POST(new Request('http://localhost/api/minimax/music/cover-preprocess', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audioUrl: 'https://example.com/reference.mp3',
      }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      coverFeatureId: 'cover-feature-1',
      formattedLyrics: '[Verse]\nCity lights',
      structureResult: '{"sections":["Verse"]}',
      audioDurationSeconds: 42,
      traceId: 'trace-cover-1',
      metadata: { status: 0, message: 'success' },
      coverPreprocessId: 'library-cover-preprocess-1',
    });
    expect(executeMock).toHaveBeenCalledWith(expect.objectContaining({
      model: 'music-cover',
      audioUrl: 'https://example.com/reference.mp3',
      audioBase64: '',
    }));
    expect(recordGenerationBestEffortMock).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'music',
      source: 'cover-preprocess',
      title: 'Cover preprocess',
      prompt: '[Verse]\nCity lights',
      model: 'music-cover',
      providerGenerationId: 'cover-feature-1',
      metadata: expect.objectContaining({
        coverFeatureId: 'cover-feature-1',
        formattedLyrics: '[Verse]\nCity lights',
        structureResult: '{"sections":["Verse"]}',
        audioDurationSeconds: 42,
        traceId: 'trace-cover-1',
        expiresAt: expect.any(Number),
        referenceAudio: {
          source: 'url',
          audioUrl: 'https://example.com/reference.mp3',
        },
        providerMetadata: { status: 0, message: 'success' },
      }),
      assets: [expect.objectContaining({
        kind: 'metadata',
        storageType: 'metadata_only',
        expiresAt: expect.any(Number),
        role: 'cover_feature',
      })],
    }));
  });

  it('records upload metadata without storing raw base64 audio content', async () => {
    const { POST } = await import('./route');
    const rawAudio = 'reference audio';
    const audioBase64 = Buffer.from(rawAudio).toString('base64');
    executeMock.mockResolvedValue({
      coverFeatureId: 'cover-feature-upload',
      formattedLyrics: '[Chorus]\nNeon rain',
      structureResult: '{"sections":["Chorus"]}',
      audioDurationSeconds: 30,
      traceId: 'trace-upload-1',
      metadata: { status: 0, message: 'success' },
    });

    const response = await POST(new Request('http://localhost/api/minimax/music/cover-preprocess', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audioBase64 }),
    }));

    expect(response.status).toBe(200);
    expect(recordGenerationBestEffortMock).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        coverFeatureId: 'cover-feature-upload',
        referenceAudio: {
          source: 'upload',
          byteLength: Buffer.byteLength(rawAudio),
          dataUrl: false,
        },
      }),
    }));
    const persistedPayload = JSON.stringify(recordGenerationBestEffortMock.mock.calls[0][0]);
    expect(persistedPayload).not.toContain(audioBase64);
    expect(persistedPayload).not.toContain(rawAudio);
  });

  it('preserves preprocess success when Library recording fails', async () => {
    const { POST } = await import('./route');
    recordGenerationBestEffortMock.mockReturnValue(null);
    executeMock.mockResolvedValue({
      coverFeatureId: 'cover-feature-1',
      formattedLyrics: '[Verse]\nCity lights',
      structureResult: '{"sections":["Verse"]}',
      audioDurationSeconds: 42,
      traceId: 'trace-cover-1',
      metadata: { status: 0, message: 'success' },
    });

    const response = await POST(new Request('http://localhost/api/minimax/music/cover-preprocess', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audioUrl: 'https://example.com/reference.mp3' }),
    }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.coverFeatureId).toBe('cover-feature-1');
    expect(body.coverPreprocessId).toBeUndefined();
  });

  it('rejects duplicate reference audio sources before calling MiniMax', async () => {
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/music/cover-preprocess', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audioUrl: 'https://example.com/reference.mp3',
        audioBase64: Buffer.from('reference audio').toString('base64'),
      }),
    }));

    expect(response.status).toBe(400);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('requires app auth', async () => {
    const { POST } = await import('./route');

    const response = await POST(new Request('http://localhost/api/minimax/music/cover-preprocess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioUrl: 'https://example.com/reference.mp3' }),
    }));

    expect(response.status).toBe(401);
    expect(executeMock).not.toHaveBeenCalled();
  });
});
