/** @vitest-environment node */

/**
 * Redirecciones de compatibilidad: las rutas viejas de la API responden 308
 * hacia la nueva, y las rutas ya canónicas no se tocan.
 */

import { describe, expect, it } from 'vitest';

import { middleware } from './middleware';

function redirectFor(pathname: string, search = '') {
  const nextRequest = {
    nextUrl: new URL(`http://localhost${pathname}${search}`),
    url: `http://localhost${pathname}${search}`,
  };
  return middleware(nextRequest as never);
}

describe('middleware de compatibilidad de la API', () => {
  it('redirige las rutas viejas con 308 hacia la ruta canónica', () => {
    const cases: Array<[string, string]> = [
      ['/api/minimax/tts', '/api/minimax/speech/t2a'],
      ['/api/minimax/tts/stream', '/api/minimax/speech/t2a/stream'],
      ['/api/minimax/async/submit', '/api/minimax/speech/t2a/async'],
      ['/api/minimax/async/status/123', '/api/minimax/speech/t2a/async/123'],
      ['/api/minimax/async/result/456', '/api/minimax/speech/t2a/async/file/456'],
      ['/api/minimax/voices', '/api/minimax/speech/voices'],
      ['/api/minimax/voices/clone', '/api/minimax/speech/voices/clone'],
      ['/api/minimax/voices/design', '/api/minimax/speech/voices/design'],
      ['/api/minimax/music', '/api/minimax/music/generations'],
      ['/api/minimax/files/upload', '/api/minimax/files'],
      ['/api/minimax/files/list', '/api/minimax/files'],
    ];

    for (const [from, to] of cases) {
      const response = redirectFor(from);
      expect(response.status).toBe(308);
      expect(response.headers.get('location')).toBe(`http://localhost${to}`);
    }
  });

  it('conserva el query string al redirigir', () => {
    const response = redirectFor('/api/minimax/files/list', '?purpose=voice_clone');
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'http://localhost/api/minimax/files?purpose=voice_clone',
    );
  });

  it('no redirige las rutas ya canónicas ni las de otro dominio', () => {
    const untouched = [
      '/api/minimax/music/lyrics',
      '/api/minimax/music/cover-preprocess',
      '/api/minimax/speech/t2a',
      '/api/minimax/speech/t2a/async',
      '/api/minimax/files',
      '/api/minimax/image',
      '/api/minimax/video/generation',
      '/api/library/generations',
    ];

    for (const pathname of untouched) {
      const response = redirectFor(pathname);
      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
    }
  });
});
