/**
 * Shared, presentation-free video form vocabulary.
 *
 * The model capabilities and the scenario rules come from the shared DTO so
 * the browser and the server always agree on what MiniMax accepts.
 */

import {
  VIDEO_MODEL_CAPABILITIES,
  VIDEO_MODELS,
  VIDEO_RATIOS,
  type VideoModel,
} from '@/application/dto/VideoDTO';

export interface VideoOption {
  value: string;
  label: string;
}

/** Media references collected by the composition forms. */
export interface VideoMediaValues {
  firstFrame: string;
  lastFrame: string;
  referenceImages: string;
  referenceVideos: string;
  referenceAudio: string;
}

export const EMPTY_VIDEO_MEDIA: VideoMediaValues = {
  firstFrame: '',
  lastFrame: '',
  referenceImages: '',
  referenceVideos: '',
  referenceAudio: '',
};

export type VideoScenario = 'text-to-video' | 'image-to-video' | 'reference-to-video';

const CONCRETE_RATIOS = VIDEO_RATIOS.filter((ratio) => ratio !== 'adaptive');

export const VIDEO_MODEL_OPTIONS: VideoOption[] = VIDEO_MODELS.map((model) => ({
  value: model,
  label: model,
}));

export function videoResolutionOptions(model: VideoModel): VideoOption[] {
  return VIDEO_MODEL_CAPABILITIES[model].resolutions.map((resolution) => ({
    value: resolution,
    label: resolution,
  }));
}

export function videoDurationRange(model: VideoModel): { min: number; max: number } {
  const capabilities = VIDEO_MODEL_CAPABILITIES[model];
  return { min: capabilities.minDuration, max: capabilities.maxDuration };
}

/**
 * The aspect ratios offered for the current scenario.
 *
 * Text-to-video requires a concrete ratio, image-to-video is always adaptive,
 * and reference-to-video accepts both unless the model refuses `adaptive`.
 */
export function videoRatioOptions(scenario: VideoScenario, model: VideoModel): VideoOption[] {
  if (scenario === 'image-to-video') {
    return [{ value: 'adaptive', label: 'Adaptive (taken from the input image)' }];
  }

  if (scenario === 'text-to-video') {
    return CONCRETE_RATIOS.map((ratio) => ({ value: ratio, label: ratio }));
  }

  const concrete = CONCRETE_RATIOS.map((ratio) => ({ value: ratio, label: ratio }));
  if (!VIDEO_MODEL_CAPABILITIES[model].supportsAdaptiveRatio) {
    return concrete;
  }

  return [{ value: 'adaptive', label: 'Adaptive (chosen by MiniMax)' }, ...concrete];
}

/**
 * Derives the scenario from the media references the user provided.
 */
export function detectVideoScenario(media: VideoMediaValues): VideoScenario {
  if (media.firstFrame.trim().length > 0 || media.lastFrame.trim().length > 0) {
    return 'image-to-video';
  }

  if (
    media.referenceImages.trim().length > 0
    || media.referenceVideos.trim().length > 0
    || media.referenceAudio.trim().length > 0
  ) {
    return 'reference-to-video';
  }

  return 'text-to-video';
}

/**
 * Splits a comma separated list of media references.
 */
export function splitMediaReferences(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
