'use client';

import { useEffect, useState } from 'react';
import { Box } from '@chakra-ui/react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Spec, SpecList } from '@/components/ui/spec';
import { authFetch, parseApiError } from '@/lib/auth-client';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import { TTLCounter } from '@/components/shared/TTLCounter';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import type { LibraryAssetDTO, LibraryGenerationDTO, LibraryGenerationKind, LibraryGenerationSource } from '@/application/dto/library/LibraryDTO';
import { ConsoleBand } from '@/components/ui/console-band';

type LibraryFilter = 'all' | LibraryGenerationKind;

const FILTERS: Array<{ value: LibraryFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'tts', label: 'Audio' },
  { value: 'music', label: 'Music' },
  { value: 'image', label: 'Images' },
  { value: 'video', label: 'Videos' },
  { value: 'clone', label: 'Cloned voices' },
  { value: 'design', label: 'Designed voices' },
];

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

function getStringMetadata(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === 'string' ? value : undefined;
}

function getNumberMetadata(metadata: Record<string, unknown>, key: string): number | undefined {
  const value = metadata[key];
  return typeof value === 'number' ? value : undefined;
}

function getBooleanMetadata(metadata: Record<string, unknown>, key: string): boolean | undefined {
  const value = metadata[key];
  return typeof value === 'boolean' ? value : undefined;
}

function getDownloadUrl(generation: LibraryGenerationDTO, asset: LibraryAssetDTO): string {
  return `/api/library/generations/${encodeURIComponent(generation.id)}/assets/${encodeURIComponent(asset.id)}`;
}

function openUrl(url: string): void {
  window.open(url, '_blank');
}

function downloadUrl(url: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function getItemBadgeVariant(kind: LibraryGenerationKind): 'success' | 'purple' | 'info' {
  if (kind === 'video') return 'info';
  if (kind === 'image') return 'info';
  if (kind === 'music') return 'purple';
  if (kind === 'clone') return 'purple';
  if (kind === 'design') return 'info';
  return 'success';
}

function getItemTypeLabel(kind: LibraryGenerationKind): string {
  if (kind === 'video') return 'Generated video';
  if (kind === 'image') return 'Generated image';
  if (kind === 'music') return 'Generated music';
  if (kind === 'clone') return 'Cloned voice';
  if (kind === 'design') return 'Designed voice';
  return 'Generated audio';
}

function getSourceLabel(source: LibraryGenerationSource | null): string | null {
  if (source === 'video-generation') return 'Video Generation';
  if (source === 'video-context-ir') return 'Video Context-IR';
  if (source === 'video-regeneration') return 'Video Regeneration';
  if (source === 'image-to-image') return 'Image to Image';
  if (source === 'text-to-image') return 'Text to Image';
  if (source === 'text-to-music') return 'Text to Music';
  if (source === 'instrumental-music') return 'Instrumental Music';
  if (source === 'cover-preprocess') return 'Cover Preprocess';
  if (source === 'text-to-speech') return 'Text to Speech';
  return null;
}

function isCoverPreprocessGeneration(generation: LibraryGenerationDTO): boolean {
  return generation.source === 'cover-preprocess';
}

function getStorageStatus(generation: LibraryGenerationDTO): { label: string; variant: 'success' | 'info' | 'warning' | 'secondary' } {
  if (generation.kind === 'video') {
    if (generation.source === 'video-context-ir' && generation.status === 'completed') return { label: 'Enhanced prompt', variant: 'success' };
    if (generation.status === 'processing') return { label: 'Processing', variant: 'info' };
    if (generation.status === 'failed') return { label: getStringMetadata(generation.metadata, 'providerStatus') === 'cancelled' ? 'Cancelled' : 'Failed', variant: 'warning' };
    if (generation.assets.some((asset) => asset.kind === 'video' && isDownloadable(asset))) return { label: 'Temporary video URL', variant: 'info' };
    return { label: 'Video unavailable', variant: 'warning' };
  }
  const audioAsset = generation.assets.find((asset) => asset.kind === 'audio');
  const imageAssets = generation.assets.filter((asset) => asset.kind === 'image');

  if (isCoverPreprocessGeneration(generation)) {
    const expiresAt = getNumberMetadata(generation.metadata, 'expiresAt');
    if (expiresAt && expiresAt <= Date.now()) return { label: 'Cover ID expired', variant: 'warning' };
    return { label: 'Cover feature ID', variant: 'info' };
  }

  if (generation.kind === 'image') {
    const firstImage = imageAssets[0];
    if (firstImage?.expiresAt && firstImage.expiresAt <= Date.now()) return { label: 'URL may be expired', variant: 'warning' };
    if (imageAssets.some((asset) => asset.storageType === 'provider_url' && asset.storageRef)) return { label: 'Provider URLs', variant: 'info' };
    if (imageAssets.some((asset) => asset.storageType === 'local_file')) return { label: 'Stored on server', variant: 'success' };
    return { label: 'Image unavailable', variant: 'warning' };
  }

  if (audioAsset?.storageType === 'local_file') return { label: 'Stored on server', variant: 'success' };
  if (audioAsset?.storageType === 'provider_url') return { label: 'Temporary URL', variant: 'info' };
  if (generation.kind === 'tts' || generation.kind === 'music') return { label: 'Metadata only', variant: 'secondary' };
  return { label: 'Voice metadata', variant: 'secondary' };
}

function isDownloadable(asset: LibraryAssetDTO): boolean {
  return (asset.storageType === 'local_file' || asset.storageType === 'provider_url') && Boolean(asset.storageRef);
}

function getCoverGenerationHref(generation: LibraryGenerationDTO): string | null {
  const coverFeatureId = getStringMetadata(generation.metadata, 'coverFeatureId');
  const expiresAt = getNumberMetadata(generation.metadata, 'expiresAt');

  if (!coverFeatureId || !expiresAt || expiresAt <= Date.now()) return null;

  const params = new URLSearchParams({
    coverPreprocessId: generation.id,
  });

  return `/music?${params.toString()}`;
}

interface LibraryItemCardProps {
  generation: LibraryGenerationDTO;
  onDelete: (generation: LibraryGenerationDTO) => void;
}

function LibraryItemCard({ generation, onDelete }: LibraryItemCardProps) {
  const videoAsset = generation.assets.find((asset) => asset.kind === 'video' && isDownloadable(asset));
  const enhancedPrompt = generation.kind === 'video' ? getStringMetadata(generation.metadata, 'enhancedPrompt') : undefined;
  const audioAsset = generation.assets.find((asset) => asset.kind === 'audio' && isDownloadable(asset));
  const imageAssets = generation.assets.filter((asset) => asset.kind === 'image' && isDownloadable(asset));
  const storageStatus = getStorageStatus(generation);
  const aspectRatio = getStringMetadata(generation.metadata, 'aspectRatio');
  const sourceLabel = getSourceLabel(generation.source);
  const coverGenerationHref = getCoverGenerationHref(generation);
  const coverExpiresAt = isCoverPreprocessGeneration(generation) ? getNumberMetadata(generation.metadata, 'expiresAt') : undefined;
  const isExpiredCoverPreprocess = isCoverPreprocessGeneration(generation) && !coverGenerationHref;

  return (
    <Sheet>
      <SheetHeader>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between">
          <Box>
            <SheetTitle style={{ fontSize: '0.875rem' }}>{isCoverPreprocessGeneration(generation) ? 'Cover preprocess' : getItemTypeLabel(generation.kind)}</SheetTitle>
            <SheetDescription style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
              {formatDate(generation.createdAt)}
            </SheetDescription>
          </Box>
          <Box display="flex" gap={1} flexWrap="wrap" justifyContent="flex-end">
            <Badge variant={getItemBadgeVariant(generation.kind)}>{generation.kind}</Badge>
            <Badge variant={storageStatus.variant}>{storageStatus.label}</Badge>
          </Box>
        </Box>
      </SheetHeader>
      <SheetContent display="grid" gap={2}>
        {generation.prompt && (
          <p style={{ fontSize: '0.875rem', color: 'var(--chakra-colors-content-readout)' }}>
            &ldquo;{truncateText(generation.prompt, 80)}&rdquo;
          </p>
        )}
        {sourceLabel && <Spec label="Source" value={sourceLabel} />}
        {generation.model && <Spec label="Model" value={generation.model} />}
        {getStringMetadata(generation.metadata, 'voiceId') && (
          <Spec label="Voice" value={getStringMetadata(generation.metadata, 'voiceId') ?? ''} />
        )}
        {generation.providerFileId && (
          <Spec label="File" value={generation.providerFileId} />
        )}
        {generation.kind === 'image' && (
          <SpecList>
            {aspectRatio && <Spec label="Aspect ratio" value={aspectRatio} />}
            {getNumberMetadata(generation.metadata, 'seed') !== undefined && (
              <Spec label="Seed" value={String(getNumberMetadata(generation.metadata, 'seed'))} />
            )}
            {getBooleanMetadata(generation.metadata, 'promptOptimizer') !== undefined && (
              <Spec
                label="Prompt optimizer"
                value={getBooleanMetadata(generation.metadata, 'promptOptimizer') ? 'On' : 'Off'}
              />
            )}
          </SpecList>
        )}
        {generation.kind === 'music' && (
          <SpecList>
            {audioAsset?.format && <Spec label="Format" value={audioAsset.format.toUpperCase()} />}
            {getNumberMetadata(generation.metadata, 'durationSeconds') !== undefined && (
              <Spec
                label="Duration"
                value={`${Math.round(getNumberMetadata(generation.metadata, 'durationSeconds') ?? 0)}s`}
              />
            )}
            {getNumberMetadata(generation.metadata, 'audioDurationSeconds') !== undefined && (
              <Spec
                label="Reference duration"
                value={`${Math.round(getNumberMetadata(generation.metadata, 'audioDurationSeconds') ?? 0)}s`}
              />
            )}
            {getNumberMetadata(generation.metadata, 'sampleRate') !== undefined && (
              <Spec
                label="Sample rate"
                value={`${getNumberMetadata(generation.metadata, 'sampleRate')} Hz`}
              />
            )}
            {getNumberMetadata(generation.metadata, 'bitrate') !== undefined && (
              <Spec
                label="Bitrate"
                value={`${Math.round((getNumberMetadata(generation.metadata, 'bitrate') ?? 0) / 1000)} kbps`}
              />
            )}
          </SpecList>
        )}
        {isExpiredCoverPreprocess && (
          <p style={{ fontSize: '0.75rem', color: 'var(--chakra-colors-state-run)' }}>
            This cover feature ID expired. Run Cover Preprocess again before using it for cover generation.
          </p>
        )}
        {isCoverPreprocessGeneration(generation) && !isExpiredCoverPreprocess && (
          <p style={{ fontSize: '0.75rem', color: 'var(--chakra-colors-state-ok)' }}>
            This intermediate Library record stores the cover feature ID metadata only. Reference audio bytes were not saved.
          </p>
        )}
        {generation.kind === 'video' && (
          <Box display="grid" gap={2} gridTemplateColumns="minmax(0, 1fr)">
            <SpecList>
              <Spec label="Task" value={generation.providerTaskId ?? 'not returned'} />
              <Spec
                label="Status"
                value={getStringMetadata(generation.metadata, 'providerStatus') ?? generation.status}
              />
            </SpecList>
            {enhancedPrompt && <Box whiteSpace="pre-wrap" fontSize="sm">{enhancedPrompt}</Box>}
            {videoAsset?.storageRef && (
              <>
                <video controls preload="metadata" src={videoAsset.storageRef} aria-label="Generated video" style={{ width: '100%', borderRadius: 'var(--chakra-radii-md)' }} />
                <Box fontSize="xs" color="content.subtle">This provider URL is temporary. Download the video before it expires; an exact expiration time is not provided.</Box>
                <Button size="sm" onClick={() => downloadUrl(videoAsset.storageType === 'provider_url' ? videoAsset.storageRef! : getDownloadUrl(generation, videoAsset))}>Download video</Button>
              </>
            )}
            <a href="/video/generation">Open Video Studio</a>
          </Box>
        )}
        {imageAssets.length > 0 && (
          <Box display="grid" gap={3} gridTemplateColumns="repeat(auto-fit, minmax(8rem, 1fr))" mt={2}>
            {imageAssets.map((asset, index) => {
              const assetUrl = getDownloadUrl(generation, asset);
              const previewUrl = asset.storageType === 'provider_url' && asset.storageRef ? asset.storageRef : assetUrl;

              return (
                <Box key={asset.id} border="1px solid" borderColor="interaction.soft" borderRadius="lg" overflow="hidden" bg="surface.field">
                  <img
                    src={previewUrl}
                    alt={`Generated image ${index + 1}`}
                    loading="lazy"
                    decoding="async"
                    style={{ width: '100%', aspectRatio: aspectRatio ? aspectRatio.replace(':', ' / ') : '1 / 1', objectFit: 'cover', display: 'block' }}
                  />
                  <Box display="flex" gap={1} p="0.5rem" flexWrap="wrap">
                    <Button variant="outline" size="sm" onClick={() => openUrl(assetUrl)}>
                      Open
                    </Button>
                    <Button size="sm" onClick={() => downloadUrl(assetUrl)}>
                      Download
                    </Button>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
        {generation.kind === 'image' && imageAssets.length === 0 && (
          <p style={{ fontSize: '0.75rem', color: 'var(--chakra-colors-state-run)' }}>
            No downloadable image asset is available for this Library record.
          </p>
        )}
        {(generation.kind === 'tts' || generation.kind === 'music') && !audioAsset && !isCoverPreprocessGeneration(generation) && (
          <p style={{ fontSize: '0.75rem', color: 'var(--chakra-colors-state-run)' }}>
            This Library record has metadata only and no downloadable audio asset.
          </p>
        )}

        <Box display="flex" alignItems="center" gap={2} mt={2}>
          {imageAssets[0]?.expiresAt && <TTLCounter expiresAt={imageAssets[0].expiresAt} label="URL TTL" />}
          {coverExpiresAt && <TTLCounter expiresAt={coverExpiresAt} label="Cover ID TTL" />}
          {audioAsset && (
            <Button size="sm" onClick={() => downloadUrl(getDownloadUrl(generation, audioAsset))}>
              Download
            </Button>
          )}
          {coverGenerationHref && (
            <a href={coverGenerationHref} style={{ border: '1px solid var(--chakra-colors-state-ok)', borderRadius: '0.375rem', color: 'var(--chakra-colors-state-ok)', fontSize: '0.875rem', fontWeight: 600, padding: '0.375rem 0.75rem', textDecoration: 'none' }}>
              Use in cover generation
            </a>
          )}
          {(generation.kind === 'tts' || generation.kind === 'music') && !audioAsset && !isCoverPreprocessGeneration(generation) && (
            <Badge variant="warning">Audio not stored</Badge>
          )}
          <Button variant="outline" colorPalette="red" size="sm" onClick={() => onDelete(generation)}>
            Remove
          </Button>
        </Box>
      </SheetContent>
    </Sheet>
  );
}

export default function LibraryPage() {
  const [generations, setGenerations] = useState<LibraryGenerationDTO[]>([]);
  const [error, setError] = useState<{ code: number | null; message: string | null } | null>(null);
  const [pendingDeleteGeneration, setPendingDeleteGeneration] = useState<LibraryGenerationDTO | null>(null);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const loadGenerations = async () => {
    setError(null);

    try {
      const response = await authFetch('/api/library/generations?limit=50');

      if (!response.ok) {
        const err = await parseApiError(response);
        setError({ code: err?.code ?? response.status, message: err?.message ?? `HTTP ${response.status}` });
        return;
      }

      const data = await response.json() as { generations?: LibraryGenerationDTO[] };
      setGenerations(data.generations ?? []);
    } catch {
      setError({ code: null, message: 'Failed to load Library records.' });
    }
  };

  useEffect(() => {
    void loadGenerations();
  }, []);

  const deleteGeneration = async (generation: LibraryGenerationDTO): Promise<boolean> => {
    const response = await authFetch(`/api/library/generations/${encodeURIComponent(generation.id)}`, { method: 'DELETE' });

    if (!response.ok) {
      const err = await parseApiError(response);
      setError({ code: err?.code ?? response.status, message: err?.message ?? `HTTP ${response.status}` });
      return false;
    }

    return true;
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteGeneration) return;

    setError(null);
    setActionStatus(null);
    const deleted = await deleteGeneration(pendingDeleteGeneration).catch(() => false);

    if (!deleted) {
      setError({ code: null, message: 'Failed to remove Library record.' });
      return;
    }

    setGenerations((prev) => prev.filter((generation) => generation.id !== pendingDeleteGeneration.id));
    setActionStatus(`${getItemTypeLabel(pendingDeleteGeneration.kind)} removed from Library.`);
    setPendingDeleteGeneration(null);
  };

  const handleConfirmClearAll = async () => {
    setError(null);
    setActionStatus(null);
    const results = await Promise.all(generations.map((generation) => deleteGeneration(generation).catch(() => false)));
    const deletedIds = new Set(generations.filter((_, index) => results[index]).map((generation) => generation.id));

    setGenerations((prev) => prev.filter((generation) => !deletedIds.has(generation.id)));
    setIsClearDialogOpen(false);
    setActionStatus(deletedIds.size === generations.length ? 'Library records cleared.' : 'Some Library records could not be removed.');
  };

  const filteredGenerations = filter === 'all' ? generations : generations.filter((generation) => generation.kind === filter);

  return (
    <Box display="grid" gap={6} gridTemplateColumns="minmax(0, 1fr)">
      <ConsoleBand
        monogram="LB"
        title="Library"
        description="Everything you have generated, with the asset references kept for it."
        readoutsLabel="Stored"
        readouts={[
          { label: 'Total', value: String(generations.length) },
          { label: 'Audio', value: String(generations.filter((g) => g.kind === 'tts').length) },
          { label: 'Images', value: String(generations.filter((g) => g.kind === 'image').length) },
          { label: 'Videos', value: String(generations.filter((g) => g.kind === 'video').length) },
        ]}
        actions={
          <Box display="flex" gap={2}>
            <Button variant="console" onClick={() => void loadGenerations()}>
              Refresh
            </Button>
            {generations.length > 0 && (
              <Button variant="console" colorPalette="red" onClick={() => setIsClearDialogOpen(true)}>
                Clear all
              </Button>
            )}
          </Box>
        }
      />

      {error && <ErrorDisplay code={error.code} message={error.message} />}
      {actionStatus && !error && (
        <Box border="1px solid" borderColor="state.okSoft" borderLeft="3px solid" borderLeftColor="state.ok" borderRadius="md" bg="surface.sheet" p="0.75rem" color="state.ok" fontSize="sm">
          {actionStatus}
        </Box>
      )}

      {generations.length > 0 && (
        <Box display="flex" gap={2} flexWrap="wrap">
          {FILTERS.map((option) => (
            <Button
              key={option.value}
              variant={filter === option.value ? 'solid' : 'outline'}
              size="sm"
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </Box>
      )}

      <Box display="grid" gap={4} gridTemplateColumns={{ base: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }}>
        {filteredGenerations.map((generation) => (
          <LibraryItemCard
            key={generation.id}
            generation={generation}
            onDelete={setPendingDeleteGeneration}
          />
        ))}
        {generations.length === 0 && (
          <Sheet style={{ gridColumn: '1 / -1' }}>
            <SheetHeader>
              <SheetTitle>No Library records yet.</SheetTitle>
              <SheetDescription>
                Generate audio, music, images, or video to create Library records you can reopen later.
              </SheetDescription>
            </SheetHeader>
          </Sheet>
        )}
        {generations.length > 0 && filteredGenerations.length === 0 && (
          <Sheet style={{ gridColumn: '1 / -1' }}>
            <SheetHeader>
              <SheetTitle>No items match this filter</SheetTitle>
              <SheetDescription>Switch filters or generate new audio, music, images, video, and voices to add more Library records.</SheetDescription>
            </SheetHeader>
          </Sheet>
        )}
      </Box>

      <ConfirmationDialog
        open={pendingDeleteGeneration !== null}
        onOpenChange={(open) => !open && setPendingDeleteGeneration(null)}
        title="Remove library record?"
        description="This removes the selected Library record and any local server asset file attached to it. Provider-hosted MiniMax assets are not deleted."
        confirmLabel="Remove"
        onConfirm={handleConfirmDelete}
      />
      <ConfirmationDialog
        open={isClearDialogOpen}
        onOpenChange={setIsClearDialogOpen}
        title="Clear all Library records?"
        description="This removes every SQLite Library record and attached local server asset file. This action cannot be undone."
        confirmLabel="Clear all"
        onConfirm={handleConfirmClearAll}
      />
    </Box>
  );
}
