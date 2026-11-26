'use client';

/**
 * Shared pieces of the Video Studio.
 *
 * The studio is split into independent routes — one per MiniMax creation
 * endpoint — so each piece below is reused by every one of them.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { Box } from '@chakra-ui/react';

import { ErrorDisplay } from '@/components/shared/ErrorDisplay';

import type { VideoMediaValues } from './video-options';

export type VideoContentItem = {
  type: 'text' | 'image_url' | 'video_url' | 'audio_url';
  text?: string;
  url?: string;
  role?: string;
};

/**
 * Builds the multimodal content array shared by generation and context-ir.
 */
export function buildComposition(prompt: string, media: VideoMediaValues): VideoContentItem[] {
  const content: VideoContentItem[] = [];
  const trimmedPrompt = prompt.trim();

  if (trimmedPrompt.length > 0) {
    content.push({ type: 'text', text: trimmedPrompt });
  }

  const firstFrame = media.firstFrame.trim();
  const lastFrame = media.lastFrame.trim();

  if (firstFrame.length > 0) {
    content.push({ type: 'image_url', url: firstFrame, role: 'first_frame' });
  }
  if (lastFrame.length > 0) {
    content.push({ type: 'image_url', url: lastFrame, role: 'last_frame' });
  }

  const references = media.referenceImages.split(',').map((entry) => entry.trim()).filter(Boolean);
  for (const url of references) {
    content.push({ type: 'image_url', url, role: 'reference_image' });
  }

  const videos = media.referenceVideos.split(',').map((entry) => entry.trim()).filter(Boolean);
  for (const url of videos) {
    content.push({ type: 'video_url', url, role: 'reference_video' });
  }

  const audios = media.referenceAudio.split(',').map((entry) => entry.trim()).filter(Boolean);
  for (const url of audios) {
    content.push({ type: 'audio_url', url, role: 'reference_audio' });
  }

  return content;
}

interface VideoStudioHeaderProps {
  title: string;
  description: string;
  note: string;
}

/** The header every Video Studio route shares. */
export function VideoStudioHeader({ title, description, note }: VideoStudioHeaderProps) {
  return (
    <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={4} flexWrap="wrap">
      <Box maxW="52rem">
        <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>{title}</h1>
        <Box color="gray.600" mt={1}>
          {description}
        </Box>
      </Box>
      <Box
        border="1px solid"
        borderColor="blue.100"
        borderLeft="3px solid"
        borderLeftColor="blue.400"
        borderRadius="md"
        bg="white"
        p="0.75rem"
        color="gray.700"
        fontSize="sm"
        maxW="21rem"
      >
        {note}
      </Box>
    </Box>
  );
}

interface VideoMessageBannerProps {
  error: string | null;
  notice: string | null;
  /** Bumped on every message so a repeated identical message still scrolls. */
  nonce: number;
  children?: ReactNode;
}

/**
 * The error/notice banner.
 *
 * It sits above the form, so a submit near the bottom would leave the
 * message off-screen. Bring it back into view whenever it changes —
 * including a repeated identical message, hence the nonce.
 */
export function VideoMessageBanner({ error, notice, nonce, children }: VideoMessageBannerProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (nonce === 0) return;
    const node = ref.current;
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [nonce]);

  return (
    <div ref={ref}>
      {error && <ErrorDisplay message={error} />}
      {notice && !error && (
        <Box
          border="1px solid"
          borderColor="green.100"
          borderLeft="3px solid"
          borderLeftColor="green.400"
          borderRadius="md"
          bg="white"
          p="0.75rem"
          color="green.800"
          fontSize="sm"
        >
          {notice}
        </Box>
      )}
      {children}
    </div>
  );
}
