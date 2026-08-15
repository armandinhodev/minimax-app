import { NextResponse } from 'next/server';
import { readLocalAsset } from '@/infrastructure/assets/LocalAssetStorage';
import { SQLiteGenerationRepository } from '@/infrastructure/sqlite/SQLiteGenerationRepository';
import { requireAuth } from '../../../../../_shared/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ generationId: string; assetId: string }>;
}

function sanitizeFilenamePart(value: string | null | undefined, fallback: string): string {
  const normalized = value?.toLowerCase().replace(/^\./, '').replace(/[^a-z0-9_-]/g, '') || fallback;
  return normalized || fallback;
}

function createDownloadFilename(kind: string, generationId: string, format: string | null): string {
  const extension = sanitizeFilenamePart(format, 'bin');
  return `minimax-${sanitizeFilenamePart(kind, 'asset')}-${generationId.slice(0, 8)}.${extension}`;
}

function isSafeProviderUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function GET(request: Request, context: RouteContext) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { generationId, assetId } = await context.params;
  const generation = new SQLiteGenerationRepository().findGeneration(generationId);
  const asset = generation?.assets.find((candidate) => candidate.id === assetId);

  if (!generation || !asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  if (asset.storageType === 'provider_url' && asset.storageRef && isSafeProviderUrl(asset.storageRef)) {
    return NextResponse.redirect(asset.storageRef);
  }

  if (asset.storageType !== 'local_file' || !asset.storageRef) {
    return NextResponse.json({ error: 'Asset is not downloadable' }, { status: 404 });
  }

  try {
    const file = await readLocalAsset(asset.storageRef);
    return new NextResponse(new Uint8Array(file.bytes), {
      headers: {
        'Content-Type': asset.mimeType ?? 'application/octet-stream',
        'Content-Length': String(file.bytes.byteLength),
        'Content-Disposition': `attachment; filename="${createDownloadFilename(asset.kind, generation.id, asset.format)}"`,
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Asset file is unavailable' }, { status: 404 });
  }
}
