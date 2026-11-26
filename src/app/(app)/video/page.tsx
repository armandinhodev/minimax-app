'use client';

/**
 * /video — the Video Studio index.
 *
 * Every mode lives on its own route, mirroring the MiniMax creation
 * endpoints: /video/generation, /video/context-ir, /video/regeneration and
 * /video/tasks.
 */

import Link from 'next/link';
import { Box } from '@chakra-ui/react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { VideoStudioHeader } from './video-shared';

const WORKFLOWS = [
  {
    href: '/video/generation',
    title: 'Video Generation',
    description: 'Create a video from text, images or multimedia references.',
  },
  {
    href: '/video/context-ir',
    title: 'H3-Context-IR',
    description: 'Enrich a prompt with the multimodal context MiniMax interprets.',
  },
  {
    href: '/video/regeneration',
    title: '2K Regeneration',
    description: 'Re-render a MiniMax H3 768P result in 2K.',
  },
  {
    href: '/video/tasks',
    title: 'Tasks',
    description: 'Browse, filter and cancel the video tasks of the account.',
  },
];

export default function VideoPage() {
  return (
    <Box display="grid" gap={6} width="100%">
      <VideoStudioHeader
        title="Video Studio"
        description="Generate MiniMax H3 videos from text, images or multimedia references, enrich a prompt with H3-Context-IR, regenerate a 768P result in 2K, and follow every task from one place."
        note="MiniMax output links are time limited and the exact expiry is not published. Download a result while it is available."
      />

      <Box display="grid" gap={4} gridTemplateColumns={{ base: '1fr', md: '1fr 1fr' }}>
        {WORKFLOWS.map((workflow) => (
          <Link key={workflow.href} href={workflow.href} style={{ textDecoration: 'none' }}>
            <Card accent="blue" minH="9rem">
              <CardHeader>
                <CardTitle>{workflow.title}</CardTitle>
                <CardDescription>{workflow.description}</CardDescription>
              </CardHeader>
              <CardContent display="grid" gap={2}>
                <Box color="#0f766e" fontWeight={700} fontSize="sm">
                  Open {workflow.title}
                </Box>
              </CardContent>
            </Card>
          </Link>
        ))}
      </Box>
    </Box>
  );
}
