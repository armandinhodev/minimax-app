/** @vitest-environment node */

/**
 * GET /api/minimax/files/[fileId]/content
 * Descarga binaria de un archivo vía GET /v1/files/retrieve_content.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { retrieveContentMock } = vi.hoisted(() => ({
  retrieveContentMock: vi.fn(),
}));

vi.mock('@/infrastructure/minimax/files/FileClient', () => ({
  FileClient: vi.fn().mockImplementation(() => ({
    retrieveContent: retrieveContentMock,
  })),
}));

describe('GET /api/minimax/files/[fileId]/content', () => {
  beforeEach(() => {
    process.env.APP_ACCESS_KEY = 'test-key';
    retrieveContentMock.mockReset();
  });

  it('devuelve el binario con el content-length correcto', async () => {
    retrieveContentMock.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
    const { GET } = await import('./route');

    const response = await GET(
      new Request('http://localhost/api/minimax/files/42/content', {
        headers: { Authorization: 'Bearer test-key' },
      }),
      { params: Promise.resolve({ fileId: '42' }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/octet-stream');
    expect(response.headers.get('content-length')).toBe('4');
    expect(retrieveContentMock).toHaveBeenCalledWith('42');
  });

  it('rechaza una petición sin credenciales antes de llamar a MiniMax', async () => {
    const { GET } = await import('./route');

    const response = await GET(
      new Request('http://localhost/api/minimax/files/42/content'),
      { params: Promise.resolve({ fileId: '42' }) },
    );

    expect(response.status).toBe(401);
    expect(retrieveContentMock).not.toHaveBeenCalled();
  });

  it('mapea un fallo upstream a una respuesta 500', async () => {
    retrieveContentMock.mockRejectedValue(new Error('upstream exploded'));
    const { GET } = await import('./route');

    const response = await GET(
      new Request('http://localhost/api/minimax/files/42/content', {
        headers: { Authorization: 'Bearer test-key' },
      }),
      { params: Promise.resolve({ fileId: '42' }) },
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('An unexpected error occurred. Please try again.');
  });
});
