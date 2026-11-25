import { NextResponse } from 'next/server';

import { captureServerError, type ServerErrorContext } from '@/lib/telemetry';
import { createMiniMaxRouteErrorResponse } from '../../_shared/route-error';

interface ClientErrorLike {
  message: string;
  code: number;
  status?: number;
}

/**
 * Duck-typed check for the video client error.
 *
 * The check is name based on purpose: route tests replace the client module
 * with a stub, and `instanceof` against a stubbed class would explode.
 */
function isVideoClientError(error: unknown): error is ClientErrorLike {
  if (typeof error !== 'object' || error === null) return false;

  const candidate = error as { name?: unknown; code?: unknown; message?: unknown };
  return candidate.name === 'MiniMaxVideoError'
    && typeof candidate.code === 'number'
    && typeof candidate.message === 'string';
}

function isValidationError(error: unknown): error is { message: string } {
  return typeof error === 'object'
    && error !== null
    && (error as { name?: unknown }).name === 'VideoValidationError'
    && typeof (error as { message?: unknown }).message === 'string';
}

/**
 * Maps a video failure onto an HTTP response.
 *
 * The shared helper collapses every upstream 4xx into a generic 500, but the
 * video API returns precise, actionable errors (invalid parameters, sensitive
 * content, insufficient balance), so those are surfaced verbatim.
 */
export function createVideoRouteErrorResponse(error: unknown, context: ServerErrorContext) {
  if (isValidationError(error)) {
    captureServerError(error, { ...context, statusCode: 400 });

    return NextResponse.json(
      { error: error.message, code: 400, retryable: false },
      { status: 400 },
    );
  }

  if (isVideoClientError(error) && typeof error.status === 'number' && error.status >= 400 && error.status < 500) {
    captureServerError(error, {
      ...context,
      statusCode: error.status,
      miniMaxCode: error.code,
    });

    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        retryable: false,
        details: { upstreamStatus: error.status, upstreamMessage: error.message },
      },
      { status: error.status },
    );
  }

  return createMiniMaxRouteErrorResponse(error, context);
}
