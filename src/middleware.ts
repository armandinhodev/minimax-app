/**
 * Redirecciones de compatibilidad.
 *
 * La API de la app se reorganizó sobre el eje de dominios upstream de
 * MiniMax (speech / image / video / music / files / asr / text / video-agent).
 * Las rutas anteriores responden 308 hacia la nueva durante el período de
 * gracia, para no romper clientes externos ni enlaces guardados.
 *
 * `exact: true` exige coincidencia total; `exact: false` hace de `from` un
 * prefijo (para las rutas con parámetro). El orden importa: las reglas más
 * específicas van primero.
 */

import { NextResponse, type NextRequest } from 'next/server';

interface RedirectRule {
  readonly from: string;
  readonly to: string;
  readonly exact: boolean;
}

const REDIRECTS: readonly RedirectRule[] = [
  { from: '/api/minimax/tts/stream', to: '/api/minimax/speech/t2a/stream', exact: true },
  { from: '/api/minimax/tts', to: '/api/minimax/speech/t2a', exact: true },
  { from: '/api/minimax/async/submit', to: '/api/minimax/speech/t2a/async', exact: true },
  { from: '/api/minimax/async/status/', to: '/api/minimax/speech/t2a/async/', exact: false },
  { from: '/api/minimax/async/result/', to: '/api/minimax/speech/t2a/async/file/', exact: false },
  { from: '/api/minimax/voices/clone', to: '/api/minimax/speech/voices/clone', exact: true },
  { from: '/api/minimax/voices/design', to: '/api/minimax/speech/voices/design', exact: true },
  { from: '/api/minimax/voices', to: '/api/minimax/speech/voices', exact: true },
  { from: '/api/minimax/music', to: '/api/minimax/music/generations', exact: true },
  { from: '/api/minimax/files/upload', to: '/api/minimax/files', exact: true },
  { from: '/api/minimax/files/list', to: '/api/minimax/files', exact: true },
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  for (const rule of REDIRECTS) {
    const matches = rule.exact
      ? pathname === rule.from
      : pathname.startsWith(rule.from);
    if (!matches) continue;

    const rest = pathname.slice(rule.from.length);
    const target = new URL(`${rule.to}${rest}`, request.url);
    target.search = request.nextUrl.search;
    return NextResponse.redirect(target, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/minimax/:path*'],
};
