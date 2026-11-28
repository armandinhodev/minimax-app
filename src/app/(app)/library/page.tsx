'use client';

import { useEffect, useRef, useState } from 'react';
import { ScreenResetButton } from '@/components/shared/ScreenResetButton';
import { useScreenState } from '@/components/shared/screen-state';
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
import { AreaHeader } from '@/components/ui/area-header';
import { VideoPlate } from '@/components/ui/playback-plate';
import { Chip } from '@/components/ui/chip';
import { MetricBand } from '@/components/ui/metric-band';

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

function getItemBadgeVariant(kind: LibraryGenerationKind): 'success' | 'secondary' | 'info' {
  if (kind === 'video') return 'info';
  if (kind === 'image') return 'info';
  if (kind === 'music') return 'secondary';
  if (kind === 'clone') return 'secondary';
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
  if (source === 'video-agent') return 'Video Agent';
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
  onCheckStatus: (generation: LibraryGenerationDTO) => void;
  isChecking: boolean;
}

/** Provider task IDs can be queried while unfinished or when the video is missing. */
const RECHECKABLE_SOURCES: ReadonlySet<LibraryGenerationSource> = new Set([
  'video-generation',
  'video-context-ir',
  'video-regeneration',
  'video-agent',
]);

function canRecheckProvider(generation: LibraryGenerationDTO): boolean {
  if (generation.kind !== 'video' || !generation.providerTaskId) return false;
  // Only known video sources: an unknown source would query the wrong endpoint.
  if (!generation.source || !RECHECKABLE_SOURCES.has(generation.source)) return false;
  if (generation.status === 'processing') return true;
  return generation.status === 'completed'
    && !generation.assets.some((asset) => asset.kind === 'video' && isDownloadable(asset));
}

function LibraryItemCard({ generation, onDelete, onCheckStatus, isChecking }: LibraryItemCardProps) {
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
    <Sheet borderRadius="md">
      <SheetHeader borderBottom="none" pt="16px" pb="0">
        <Box display="flex" alignItems="flex-start" justifyContent="space-between">
          <Box>
            <SheetTitle style={{ fontSize: '1.0625rem' }}>{isCoverPreprocessGeneration(generation) ? 'Cover preprocess' : getItemTypeLabel(generation.kind)}</SheetTitle>
            <SheetDescription style={{ fontSize: '0.8125rem', marginTop: '2px' }}>
              Created {formatDate(generation.createdAt)}
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
        {getStringMetadata(generation.metadata, 'emotion') && (
          <Spec label="Emotion" value={getStringMetadata(generation.metadata, 'emotion') ?? ''} />
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
                <VideoPlate title={generation.title ?? 'Generated video'} src={videoAsset.storageRef} />
                <Box fontSize="xs" color="content.subtle">This provider URL is temporary. Download the video before it expires; an exact expiration time is not provided.</Box>
                <Button variant="outline" size="sm" onClick={() => downloadUrl(videoAsset.storageType === 'provider_url' ? videoAsset.storageRef! : getDownloadUrl(generation, videoAsset))}>Download video</Button>
              </>
            )}
            {canRecheckProvider(generation) && (
              <Button variant="outline" size="sm" disabled={isChecking} onClick={() => onCheckStatus(generation)}>
                {isChecking ? 'Checking…' : 'Check status'}
              </Button>
            )}
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
            <Button variant="outline" size="sm" onClick={() => downloadUrl(getDownloadUrl(generation, audioAsset))}>
              Download audio
            </Button>
          )}
          {coverGenerationHref && (
            <a href={coverGenerationHref} style={{ border: '1px solid var(--chakra-colors-surface-rule)', borderRadius: 'var(--chakra-radii-md)', color: 'var(--chakra-colors-content-ink)', fontSize: 'var(--chakra-font-sizes-label)', fontWeight: 700, padding: '0 14px', height: '36px', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
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
  const [generations, setGenerations] = useScreenState<LibraryGenerationDTO[]>('library:generations', []);
  const [error, setError] = useScreenState<{ code: number | null; message: string | null } | null>('library:error', null);
  const [pendingDeleteGeneration, setPendingDeleteGeneration] = useState<LibraryGenerationDTO | null>(null);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [filter, setFilter] = useScreenState<LibraryFilter>('library:filter', 'all');
  const [actionStatus, setActionStatus] = useScreenState<string | null>('library:actionStatus', null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const checkingRef = useRef(false);

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

  /**
   * Asks MiniMax for the current state of one task and reloads the local
   * record. The provider route records the result, so no regeneration happens.
   */
  const checkProviderStatus = async (generation: LibraryGenerationDTO) => {
    if (!generation.providerTaskId || checkingRef.current) return;

    checkingRef.current = true;
    setCheckingId(generation.id);
    setError(null);
    setActionStatus(null);

    try {
      const url = generation.source === 'video-agent'
        ? `/api/minimax/video-agent/generations/${encodeURIComponent(generation.providerTaskId)}`
        : `/api/minimax/video/tasks/${encodeURIComponent(generation.providerTaskId)}`;
      const response = await authFetch(url);

      if (!response.ok) {
        const err = await parseApiError(response);
        setError({ code: err?.code ?? response.status, message: err?.message ?? `HTTP ${response.status}` });
        return;
      }

      await loadGenerations();
      setActionStatus('Checked with MiniMax.');
    } catch {
      setError({ code: null, message: 'Could not check the task with MiniMax.' });
    } finally {
      checkingRef.current = false;
      setCheckingId(null);
    }
  };

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
      <AreaHeader
        title="Library"
        description="Review locally stored creations and their production details."
        actions={
          <Box display="flex" gap={2}>
            <Button variant="outline" onClick={() => void loadGenerations()}>
              Refresh
            </Button>
            <ScreenResetButton namespace="library" label="Reset filters" onReset={() => void loadGenerations()} />
            {generations.length > 0 && (
              <Button variant="destructive" onClick={() => setIsClearDialogOpen(true)}>
                Clear all
              </Button>
            )}
          </Box>
        }
      />

      <MetricBand
        metrics={[
          { label: 'Total', value: String(generations.length) },
          { label: 'Audio', value: String(generations.filter((g) => g.kind === 'tts').length) },
          { label: 'Images', value: String(generations.filter((g) => g.kind === 'image').length) },
          { label: 'Videos', value: String(generations.filter((g) => g.kind === 'video').length) },
        ]}
      />

      {error && <ErrorDisplay code={error.code} message={error.message} />}
      {actionStatus && !error && (
        <Box borderRadius="md" bg="state.okSoft" px="12px" py="10px" color="content.ink" fontSize="label">
          {actionStatus}
        </Box>
      )}

      <Sheet>
        <SheetHeader icon="folder">
          <SheetTitle>Assets</SheetTitle>
          <SheetDescription>Filter by media type and inspect production details.</SheetDescription>
        </SheetHeader>
        <SheetContent>
          {generations.length > 0 && (
            <Box display="flex" gap={2} flexWrap="wrap" mb="16px">
              {FILTERS.map((option) => (
                <Chip key={option.value} selected={filter === option.value} onClick={() => setFilter(option.value)}>
                  {option.label}
                </Chip>
              ))}
            </Box>
          )}

          <Box display="grid" gap={4} gridTemplateColumns={{ base: '1fr', xl: 'repeat(2, minmax(0, 1fr))' }}>
        {filteredGenerations.map((generation) => (
          <LibraryItemCard
            key={generation.id}
            generation={generation}
            onDelete={setPendingDeleteGeneration}
            onCheckStatus={checkProviderStatus}
            isChecking={checkingId === generation.id}
          />
        ))}
        {generations.length === 0 && (
          <Box gridColumn="1 / -1" bg="surface.inset" border="1px solid" borderColor="surface.separator" borderRadius="md" p="20px">
            <Box fontWeight={700} color="content.ink">No Library records yet.</Box>
            <Box color="content.readout" fontSize="0.9375rem" lineHeight="1.4" mt="4px">
              Generate audio, music, images, or video to create Library records you can reopen later.
            </Box>
          </Box>
        )}
        {generations.length > 0 && filteredGenerations.length === 0 && (
          <Box gridColumn="1 / -1" bg="surface.inset" border="1px solid" borderColor="surface.separator" borderRadius="md" p="20px">
            <Box fontWeight={700} color="content.ink">No items match this filter.</Box>
            <Box color="content.readout" fontSize="0.9375rem" lineHeight="1.4" mt="4px">
              Switch filters or generate new audio, music, images, video, and voices to add more Library records.
            </Box>
          </Box>
        )}
      </Box>
        </SheetContent>
      </Sheet>

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
        description="This removes every Library record and the asset files stored with them. This action cannot be undone."
        confirmLabel="Clear all"
        onConfirm={handleConfirmClearAll}
      />
    </Box>
  );
}
