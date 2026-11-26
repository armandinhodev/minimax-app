/**
 * GET /api/minimax/text/models
 * Lists the models available to the account (GET /v1/models).
 * Validates Authorization: Bearer <APP_ACCESS_KEY>.
 */

import { NextResponse } from 'next/server';

import { ListModelsUseCase } from '@/application/use-cases/minimax/text/ListModels';
import { TextClient } from '@/infrastructure/minimax/text/TextClient';

import { requireAuth } from '@/app/api/_shared/auth';
import { createMiniMaxRouteErrorResponse } from '../../_shared/route-error';

export async function GET(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const useCase = new ListModelsUseCase(new TextClient());
    const models = await useCase.execute();
    return NextResponse.json({ models });
  } catch (error) {
    return createMiniMaxRouteErrorResponse(error, {
      endpoint: '/api/minimax/text/models',
      method: 'GET',
      statusCode: 500,
    });
  }
}
