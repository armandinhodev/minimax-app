/**
 * GET /api/minimax/video-agent/templates
 * The official Video Agent template catalogue.
 *
 * MiniMax publishes this list in its FAQ, not through an endpoint, so the app
 * serves the curated copy it ships with.
 * Validates Authorization: Bearer <APP_ACCESS_KEY>.
 */

import { NextResponse } from 'next/server';

import { VIDEO_AGENT_TEMPLATES } from '@/application/dto/minimax/video-agent/VideoAgentDTO';

import { requireAuth } from '@/app/api/_shared/auth';

export async function GET(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;

  return NextResponse.json({ templates: VIDEO_AGENT_TEMPLATES });
}
