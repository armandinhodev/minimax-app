import { NextResponse } from 'next/server';
import { deleteLocalAsset } from '@/infrastructure/assets/LocalAssetStorage';
import { SQLiteGenerationRepository } from '@/infrastructure/sqlite/SQLiteGenerationRepository';
import { requireAuth } from '../../../_shared/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ generationId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { generationId } = await context.params;
  const generation = new SQLiteGenerationRepository().findGeneration(generationId);

  if (!generation) {
    return NextResponse.json({ error: 'Generation not found' }, { status: 404 });
  }

  return NextResponse.json({ generation });
}

export async function DELETE(request: Request, context: RouteContext) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { generationId } = await context.params;
  const repository = new SQLiteGenerationRepository();
  const generation = repository.findGeneration(generationId);
  const deleted = repository.deleteGeneration(generationId);

  if (deleted && generation) {
    await Promise.all(generation.assets
      .filter((asset) => asset.storageType === 'local_file')
      .map((asset) => deleteLocalAsset(asset.storageRef).catch((error) => {
        console.error('Failed to delete local asset file.', error);
      })));
  }

  return NextResponse.json({ deleted });
}
