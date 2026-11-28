'use client';

/**
 * The console front panel.
 *
 * A rack of instruments, not a grid of cards: each product area is a row
 * with its monogram, what it does and how much has been generated with it.
 */

import { useEffect } from 'react';
import { useScreenState } from '@/components/shared/screen-state';
import Link from 'next/link';
import { Box } from '@chakra-ui/react';

import type { LibraryGenerationDTO, LibrarySummaryDTO } from '@/application/dto/library/LibraryDTO';
import { AreaHeader } from '@/components/ui/area-header';
import { MetricBand } from '@/components/ui/metric-band';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Icon } from '@/components/ui/icons';
import { AREA_ICONS } from '@/components/navigation/Sidebar';
import { PRODUCT_NAV_SECTIONS } from '@/components/navigation/nav-config';
import { authFetch } from '@/lib/auth-client';

const EMPTY_SUMMARY: LibrarySummaryDTO = {
  totalGenerations: 0,
  totalAssets: 0,
  completedGenerations: 0,
  byKind: { tts: 0, image: 0, music: 0, video: 0, clone: 0, design: 0 },
  recentGenerations: [],
};

/** Library kinds each product area owns. */
const KINDS_BY_AREA: Record<string, Array<keyof LibrarySummaryDTO['byKind']>> = {
  speech: ['tts', 'clone', 'design'],
  image: ['image'],
  music: ['music'],
  video: ['video'],
};

const AREA_DESCRIPTION: Record<string, string> = {
  speech: 'Generate speech and transcribe audio',
  text: 'Talk to MiniMax M3 models',
  image: 'Create images from prompts',
  music: 'Compose songs and instrumentals',
  video: 'Generate H3 video and regenerate in 2K',
  'video-agent': 'Render a video from a template',
  library: 'Review metadata and asset references',
};

function getGenerationLabel(generation: LibraryGenerationDTO): string {
  if (generation.kind === 'tts') return 'Speech';
  if (generation.kind === 'music') return 'Music';
  if (generation.kind === 'image') return 'Image';
  if (generation.kind === 'video') return 'Video';
  if (generation.kind === 'clone') return 'Voice clone';
  return 'Designed voice';
}

function getGenerationHref(generation: LibraryGenerationDTO): string {
  if (generation.kind === 'music') return '/music';
  if (generation.kind === 'image') return '/image';
  if (generation.kind === 'video') return '/video/generation';
  if (generation.kind === 'clone' || generation.kind === 'design') return '/voices';
  return '/tts';
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DashboardPage() {
  const [summary, setSummary] = useScreenState<LibrarySummaryDTO>('overview:summary', EMPTY_SUMMARY);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      try {
        const response = await authFetch('/api/library/generations?limit=5');
        if (!response.ok) return;
        const data = await response.json() as { generations?: LibraryGenerationDTO[] };
        if (!isMounted) return;
        setSummary(buildSummary(data.generations ?? []));
      } catch (error) {
        console.error('Failed to load dashboard summary.', error);
      }
    }

    void loadDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <Box display="grid" gap={6} gridTemplateColumns="minmax(0, 1fr)" width="100%">
      <AreaHeader
        title="Studio overview"
        description="Choose an area or pick up a recent creation."
      />

      <MetricBand
        metrics={[
          { label: 'Generations', value: String(summary.totalGenerations) },
          { label: 'Completed', value: String(summary.completedGenerations) },
          { label: 'Assets', value: String(summary.totalAssets) },
        ]}
      />

      <Box
        display="grid"
        gap={4}
        gridTemplateColumns={{ base: '1fr', xl: 'minmax(0, 2fr) minmax(0, 1fr)' }}
        alignItems="start"
      >
        <Sheet>
          <SheetHeader icon="overview">
            <SheetTitle>Areas</SheetTitle>
            <SheetDescription>Choose a production workspace.</SheetDescription>
          </SheetHeader>
          <SheetContent>
            {PRODUCT_NAV_SECTIONS.map((area, index) => {
              const kinds = KINDS_BY_AREA[area.id] ?? [];
              const count = kinds.reduce((total, kind) => total + summary.byKind[kind], 0);
              const value = area.id === 'library' ? String(summary.totalAssets) + ' assets' : kinds.length > 0 ? String(count) : '—';

              return (
                <Link
                  key={area.id}
                  href={area.href}
                  style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                >
                  <Box
                    display="grid"
                    gridTemplateColumns="36px minmax(0, 1fr) auto"
                    gap="12px"
                    alignItems="center"
                    py="12px"
                    borderTop={index === 0 ? 'none' : '1px solid'}
                    borderColor="surface.separator"
                  >
                    <Box
                      aria-hidden="true"
                      display="inline-flex"
                      alignItems="center"
                      justifyContent="center"
                      w="36px"
                      h="36px"
                      bg="surface.inset"
                      border="1px solid"
                      borderColor="surface.separator"
                      borderRadius="md"
                      color="content.readout"
                    >
                      <Icon name={AREA_ICONS[area.id]} size={18} />
                    </Box>
                    <Box minW={0}>
                      <Box fontWeight={700} fontSize="body" lineHeight="1.3">
                        {area.label}
                      </Box>
                      <Box color="content.readout" fontSize="label" lineHeight="label" mt="1px">
                        {AREA_DESCRIPTION[area.id] ?? area.description}
                      </Box>
                    </Box>
                    <Box
                      fontFamily="mono"
                      fontSize="mono"
                      color="content.readout"
                      fontVariantNumeric="tabular-nums"
                      textAlign="right"
                    >
                      {value}
                    </Box>
                  </Box>
                </Link>
              );
            })}
          </SheetContent>
        </Sheet>

        <Sheet>
          <SheetHeader icon="folder">
            <SheetTitle>Recent creations</SheetTitle>
            <SheetDescription>Latest outputs from this studio.</SheetDescription>
          </SheetHeader>
          <SheetContent display="grid" gap="16px">
            {summary.recentGenerations.length === 0 ? (
              <Box
                display="grid"
                gap="6px"
                placeItems="center"
                textAlign="center"
                minH="180px"
                bg="surface.inset"
                border="1px solid"
                borderColor="surface.separator"
                borderRadius="md"
                p="20px"
              >
                <Icon name="library" size={28} />
                <Box fontWeight={700} fontSize="label">Generate your first asset</Box>
                <Box color="content.readout" fontSize="help" lineHeight="help">
                  Speech, image, video or music: the latest outputs land here.
                </Box>
              </Box>
            ) : (
              <Box display="grid">
                {summary.recentGenerations.map((generation, index) => (
                  <Link
                    key={generation.id}
                    href={getGenerationHref(generation)}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <Box
                      display="grid"
                      gridTemplateColumns="minmax(0, 1fr) auto"
                      gap="4px 12px"
                      alignItems="baseline"
                      py="10px"
                      borderTop={index === 0 ? 'none' : '1px solid'}
                      borderColor="surface.separator"
                    >
                      <Box fontWeight={700} fontSize="label" lineHeight="label" minW={0} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                        {generation.title ?? generation.prompt ?? getGenerationLabel(generation)}
                      </Box>
                      <Box fontFamily="mono" fontSize="0.75rem" color="content.readout" whiteSpace="nowrap">
                        {formatDate(generation.createdAt)}
                      </Box>
                      <Box color="content.readout" fontSize="help" lineHeight="help">
                        {getGenerationLabel(generation)}
                      </Box>
                    </Box>
                  </Link>
                ))}
              </Box>
            )}
          </SheetContent>
        </Sheet>
      </Box>
    </Box>
  );
}

function buildSummary(generations: LibraryGenerationDTO[]): LibrarySummaryDTO {
  return generations.reduce<LibrarySummaryDTO>((summary, generation) => {
    summary.totalGenerations += 1;
    summary.totalAssets += generation.assets.length;
    summary.byKind[generation.kind] += 1;
    if (generation.status === 'completed') summary.completedGenerations += 1;
    return summary;
  }, {
    ...EMPTY_SUMMARY,
    byKind: { ...EMPTY_SUMMARY.byKind },
    recentGenerations: generations.slice(0, 5),
  });
}
