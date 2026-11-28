'use client';

import { useEffect, useMemo } from 'react';

import { useScreenState } from '@/components/shared/screen-state';

import type { VideoModel, VideoRatio } from '@/application/dto/minimax/video/VideoDTO';

import { EMPTY_VIDEO_MEDIA, detectVideoScenario, type VideoMediaValues, videoRatioOptions } from './video-options';

/**
 * Keeps the media references, the derived scenario and the aspect ratio of a
 * composition form in sync.
 *
 * The ratio is corrected whenever the scenario or the model changes, so the
 * browser can never submit an option that MiniMax would silently ignore.
 */
export function useVideoComposition(namespace: string, model: VideoModel, initialRatio: VideoRatio = '16:9') {
  const [media, setMedia] = useScreenState<VideoMediaValues>(`${namespace}:media`, EMPTY_VIDEO_MEDIA);
  const [ratio, setRatio] = useScreenState<VideoRatio>(`${namespace}:ratio`, initialRatio);

  const scenario = useMemo(() => detectVideoScenario(media), [media]);
  const ratioOptions = useMemo(() => videoRatioOptions(scenario, model), [scenario, model]);

  useEffect(() => {
    if (!ratioOptions.some((option) => option.value === ratio)) {
      setRatio(ratioOptions[0].value as VideoRatio);
    }
  }, [ratioOptions, ratio]);

  const updateMedia = (key: keyof VideoMediaValues, value: string) => {
    setMedia((current) => ({ ...current, [key]: value }));
  };

  return {
    media,
    updateMedia,
    ratio,
    setRatio,
    scenario,
    ratioOptions,
  };
}
