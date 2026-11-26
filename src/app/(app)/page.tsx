'use client';

/**
 * The console front panel.
 *
 * A rack of instruments, not a grid of cards: each product area is a row
 * with its monogram, what it does and how much has been generated with it.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Box } from '@chakra-ui/react';

import type { LibraryGenerationDTO, LibrarySummaryDTO } from '@/application/dto/library/LibraryDTO';
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
  speech: 'Generate speech from text',
  asr: 'Turn audio into text and subtitles',
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
  const [summary, setSummary] = useState<LibrarySummaryDTO>(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);

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
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <Box display="grid" gap={8} width="100%">
      <Box display="grid" gap={2}>
        <h1>MiniMax Studio</h1>
        <Box color="content.readout" fontSize="body" lineHeight="body" maxW="54rem">
          Dispatch a job to MiniMax, follow its state and retrieve the asset. Every area speaks to
          its own upstream endpoint.
        </Box>
      </Box>

      <Box display="grid" gap={3}>
        <Box display="flex" alignItems="baseline" justifyContent="space-between" gap={4} flexWrap="wrap">
          <h2>Instruments</h2>
          <Box color="content.subtle" fontSize="label" lineHeight="label" fontFamily="mono">
            {summary.totalGenerations} generations · {summary.completedGenerations} completed ·{' '}
            {summary.totalAssets} assets
          </Box>
        </Box>

        <Box borderTop="1px solid" borderColor="surface.rule">
          {PRODUCT_NAV_SECTIONS.map((area) => {
            const kinds = KINDS_BY_AREA[area.id] ?? [];
            const count = kinds.reduce((total, kind) => total + summary.byKind[kind], 0);

            return (
              <Link
                key={area.id}
                href={area.href}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <Box
                  display="grid"
                  gridTemplateColumns={{ base: '2rem 1fr', md: '2rem minmax(0, 1fr) 4rem' }}
                  gap={{ base: 2, md: 4 }}
                  alignItems="center"
                  py="0.75rem"
                  borderBottom="1px solid"
                  borderColor="surface.rule"
                >
                  <Box
                    aria-hidden="true"
                    display="inline-flex"
                    alignItems="center"
                    justifyContent="center"
                    h="1.75rem"
                    w="1.75rem"
                    border="1px solid"
                    borderColor="surface.rule"
                    borderRadius="md"
                    fontFamily="mono"
                    fontSize="0.6875rem"
                    color="content.readout"
                  >
                    {area.shortLabel}
                  </Box>

                  <Box minW={0}>
                    <Box fontWeight="600" fontSize="body" lineHeight="body">
                      {area.label}
                    </Box>
                    <Box color="content.subtle" fontSize="label" lineHeight="label">
                      {AREA_DESCRIPTION[area.id] ?? area.description}
                    </Box>
                  </Box>

                  <Box
                    display={{ base: 'none', md: 'block' }}
                    textAlign="right"
                    fontFamily="mono"
                    fontSize="mono"
                    color="content.readout"
                    fontVariantNumeric="tabular-nums"
                  >
                    {kinds.length > 0 ? count : '—'}
                  </Box>
                </Box>
              </Link>
            );
          })}
        </Box>
      </Box>

      <Box display="grid" gap={3}>
        <h2>Recent creations</h2>

        {!isLoading && summary.recentGenerations.length === 0 && (
          <Box
            border="1px dashed"
            borderColor="surface.rule"
            borderRadius="lg"
            p="1.5rem"
            color="content.subtle"
            fontSize="body"
          >
            Nothing here yet. Generate a speech, an image or a video to fill the library.
          </Box>
        )}

        {summary.recentGenerations.length > 0 && (
          <Box borderTop="1px solid" borderColor="surface.rule">
            {summary.recentGenerations.map((generation) => (
              <Link
                key={generation.id}
                href={getGenerationHref(generation)}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <Box
                  display="grid"
                  gridTemplateColumns={{ base: '1fr', md: 'minmax(0, 1fr) 9rem 10rem' }}
                  gap={{ base: 1, md: 4 }}
                  alignItems="baseline"
                  py="0.625rem"
                  borderBottom="1px solid"
                  borderColor="surface.rule"
                >
                  <Box fontWeight="600" fontSize="body" lineHeight="body" minW={0}>
                    {generation.title ?? generation.prompt ?? getGenerationLabel(generation)}
                  </Box>
                  <Box
                    display={{ base: 'none', md: 'block' }}
                    fontFamily="mono"
                    fontSize="mono"
                    color="content.readout"
                  >
                    {getGenerationLabel(generation)}
                  </Box>
                  <Box
                    textAlign={{ base: 'left', md: 'right' }}
                    fontFamily="mono"
                    fontSize="mono"
                    color="content.subtle"
                    fontVariantNumeric="tabular-nums"
                  >
                    {formatDate(generation.createdAt)}
                  </Box>
                </Box>
              </Link>
            ))}
          </Box>
        )}
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
