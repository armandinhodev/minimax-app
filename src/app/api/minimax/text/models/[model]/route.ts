/**
 * GET /api/minimax/text/models/[model]
 * Retrieves one model by id (GET /v1/models/{model}).
 * Validates Authorization: Bearer <APP_ACCESS_KEY>.
 */

import { NextResponse } from 'next/server';

import { TextModelSchema } from '@/application/dto/minimax/text/TextDTO';
import { TextClient } from '@/infrastructure/minimax/text/TextClient';

import { requireAuth } from '@/app/api/_shared/auth';
import { createMiniMaxRouteErrorResponse, createValidationErrorResponse } from '../../../_shared/route-error';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ model: string }> },
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { model } = await params;
  const parsed = TextModelSchema.safeParse(model);
  if (!parsed.success) {
    return createValidationErrorResponse(parsed.error);
  }

  try {
    const client = new TextClient();
    const result = await client.getModel(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return createMiniMaxRouteErrorResponse(error, {
      endpoint: '/api/minimax/text/models/[model]',
      method: 'GET',
      statusCode: 500,
    });
  }
}
