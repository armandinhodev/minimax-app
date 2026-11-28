'use client';

/**
 * Shared pieces of the Video Studio.
 *
 * The studio is split into independent routes — one per MiniMax creation
 * endpoint — so each piece below is reused by every one of them.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { Box } from '@chakra-ui/react';

import { AreaHeader } from '@/components/ui/area-header';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';

import { splitMediaReferences } from '@/lib/media-references';

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

  const references = splitMediaReferences(media.referenceImages);
  for (const url of references) {
    content.push({ type: 'image_url', url, role: 'reference_image' });
  }

  const videos = splitMediaReferences(media.referenceVideos);
  for (const url of videos) {
    content.push({ type: 'video_url', url, role: 'reference_video' });
  }

  const audios = splitMediaReferences(media.referenceAudio);
  for (const url of audios) {
    content.push({ type: 'audio_url', url, role: 'reference_audio' });
  }

  return content;
}

interface VideoStudioHeaderProps {
  title: string;
  description: string;
  note?: string;
  /** Controls that belong to the header, such as Reset. */
  actions?: ReactNode;
}

/**
 * The masthead every Video Studio route shares.
 *
 * It carries the identity of the area and the live configuration, so the
 * sheet below does not have to repeat them.
 */
export function VideoStudioHeader({
  title,
  description,
  note,
  actions,
}: VideoStudioHeaderProps) {
  return (
    <AreaHeader
      title={title}
      description={description}
      note={note}
      actions={actions}
    />
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
        <Box borderRadius="md" bg="state.okSoft" px="12px" py="10px" color="content.ink" fontSize="label">
          {notice}
        </Box>
      )}
      {children}
    </div>
  );
}
