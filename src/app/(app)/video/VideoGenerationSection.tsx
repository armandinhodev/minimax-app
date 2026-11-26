'use client';

/**
 * Video Generation — the MiniMax H3 creation workflow
 * (POST /v2/video_generation), with the task it creates.
 *
 * Its own route: /video/generation
 */

import { useState } from 'react';
import { Box } from '@chakra-ui/react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import {
  CreateVideoGenerationSchema,
  supportsPromptExpansionMode,
  type VideoModel,
  type VideoPromptExpansionMode,
  type VideoResolution,
} from '@/application/dto/minimax/video/VideoDTO';

import { VideoMediaFields } from './VideoMediaFields';
import { VideoTaskResult } from './VideoTaskResult';
import { buildComposition, VideoMessageBanner, VideoStudioHeader } from './video-shared';
import { useVideoComposition } from './useVideoComposition';
import { useVideoTaskPolling } from './useVideoTaskPolling';
import { VideoRequestError, cancelVideoTask, createVideoTask } from './video-api';
import {
  VIDEO_MODEL_OPTIONS,
  VIDEO_PROMPT_EXPANSION_OPTIONS,
  videoDurationRange,
  videoResolutionOptions,
} from './video-options';

const PROMPT_MAX_LENGTH = 7000;

export function VideoGenerationSection() {
  const [model, setModel] = useState<VideoModel>('MiniMax-H3');
  const [resolution, setResolution] = useState<VideoResolution>('2K');
  const [duration, setDuration] = useState(5);
  const [prompt, setPrompt] = useState('');
  const [promptExpansionMode, setPromptExpansionMode] = useState<VideoPromptExpansionMode>('disabled');

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorNonce, setErrorNonce] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const composition = useVideoComposition(model);
  const polling = useVideoTaskPolling();

  const durationRange = videoDurationRange(model);
  const resolutionOptions = videoResolutionOptions(model);

  const reportError = (message: string) => {
    setError(message);
    setErrorNonce((value) => value + 1);
  };

  const handleGenerate = async () => {
    const body = {
      model,
      content: buildComposition(prompt, composition.media),
      resolution,
      duration,
      ratio: composition.ratio,
      ...(supportsPromptExpansionMode(model) ? { promptExpansionMode } : {}),
    };

    const parsed = CreateVideoGenerationSchema.safeParse(body);
    if (!parsed.success) {
      reportError(parsed.error.issues.map((issue) => issue.message).join('; '));
      return;
    }

    setError(null);
    setNotice(null);
    setIsCreating(true);

    try {
      const result = await createVideoTask('/api/minimax/video/generation', body);
      polling.startPolling(result.taskId);
      setNotice(`Task ${result.taskId} was created. MiniMax is processing it.`);
    } catch (caught) {
      reportError(
        caught instanceof VideoRequestError ? caught.message : 'Could not create the video task.',
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = async (taskId: string, taskType: string) => {
    try {
      const result = await cancelVideoTask(taskId, taskType as never);
      setNotice(`Task ${result.taskId} was ${result.action}.`);
    } catch (caught) {
      reportError(
        caught instanceof VideoRequestError ? caught.message : 'Could not cancel or delete the task.',
      );
    }
  };

  return (
    <Box display="grid" gap={6} width="100%">
      <VideoStudioHeader
        title="Video Generation"
        description="Create a MiniMax H3 video from text, images or multimedia references. The model, resolution and duration follow the official limits."
        note="MiniMax output links are time limited and the exact expiry is not published. Download a result while it is available."
      />

      <VideoMessageBanner error={error} notice={notice} nonce={errorNonce} />

      <Box
        display="grid"
        gridTemplateColumns={{ base: '1fr', xl: 'minmax(0, 1.05fr) minmax(0, 0.95fr)' }}
        gap={6}
        alignItems="start"
      >
        <Card accent="blue">
          <CardHeader>
            <CardTitle>Video Generation</CardTitle>
            <CardDescription>
              Text-to-video, image-to-video or reference-to-video. The model, resolution and duration
              follow the official MiniMax limits.
            </CardDescription>
          </CardHeader>
          <CardContent display="grid" gap={4}>
            <Box display="grid" gap={2}>
              <Label htmlFor="video-generation-model">Model</Label>
              <Select
                id="video-generation-model"
                value={model}
                options={VIDEO_MODEL_OPTIONS}
                disabled={isCreating}
                onValueChange={(value) => {
                  const nextModel = value as VideoModel;
                  setModel(nextModel);
                  const allowed = videoResolutionOptions(nextModel).map((option) => option.value);
                  if (!allowed.includes(resolution)) {
                    setResolution(allowed[allowed.length - 1] as VideoResolution);
                  }
                  const range = videoDurationRange(nextModel);
                  if (duration < range.min || duration > range.max) {
                    setDuration(range.min);
                  }
                }}
              />
            </Box>

            <Box display="grid" gap={2}>
              <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
                <Label htmlFor="video-generation-prompt">Prompt</Label>
                <Box as="span" color="gray.500" fontSize="sm">{prompt.length}/{PROMPT_MAX_LENGTH}</Box>
              </Box>
              <Textarea
                id="video-generation-prompt"
                value={prompt}
                disabled={isCreating}
                maxLength={PROMPT_MAX_LENGTH}
                minH="8rem"
                placeholder="Example: A cinematic shot of a neon-lit Tokyo alley in the rain, slow dolly forward."
                onChange={(event) => setPrompt(event.currentTarget.value)}
              />
            </Box>

            <Box display="grid" gap={4} gridTemplateColumns={{ base: '1fr', sm: '1fr 1fr 1fr' }}>
              <Box display="grid" gap={2}>
                <Label htmlFor="video-generation-resolution">Resolution</Label>
                <Select
                  id="video-generation-resolution"
                  value={resolution}
                  options={resolutionOptions}
                  disabled={isCreating}
                  onValueChange={(value) => setResolution(value as VideoResolution)}
                />
              </Box>
              <Box display="grid" gap={2}>
                <Label htmlFor="video-generation-duration">Duration (seconds)</Label>
                <Input
                  id="video-generation-duration"
                  type="number"
                  min={durationRange.min}
                  max={durationRange.max}
                  value={duration}
                  disabled={isCreating}
                  onChange={(event) => setDuration(Number(event.currentTarget.value))}
                />
              </Box>
              <Box display="grid" gap={2}>
                <Label htmlFor="video-generation-ratio">Aspect ratio</Label>
                <Select
                  id="video-generation-ratio"
                  value={composition.ratio}
                  options={composition.ratioOptions}
                  disabled={isCreating}
                  onValueChange={(value) => composition.setRatio(value as typeof composition.ratio)}
                />
              </Box>
            </Box>

            <VideoMediaFields
              idPrefix="video-generation"
              values={composition.media}
              disabled={isCreating}
              onChange={composition.updateMedia}
            />

            {supportsPromptExpansionMode(model) && (
              <Box display="grid" gap={2}>
                <Label htmlFor="video-generation-prompt-expansion">Prompt expansion</Label>
                <Select
                  id="video-generation-prompt-expansion"
                  value={promptExpansionMode}
                  options={VIDEO_PROMPT_EXPANSION_OPTIONS}
                  disabled={isCreating}
                  onValueChange={(value) => setPromptExpansionMode(value as VideoPromptExpansionMode)}
                />
              </Box>
            )}

            <Button onClick={handleGenerate} disabled={isCreating} colorPalette="blue">
              {isCreating ? 'Creating task...' : 'Generate Video'}
            </Button>
          </CardContent>
        </Card>

        <Card accent="green">
          <CardHeader>
            <CardTitle>Latest Task</CardTitle>
            <CardDescription>
              The status is polled while the task runs. Only one task is tracked at a time.
            </CardDescription>
          </CardHeader>
          <CardContent display="grid" gap={3}>
            {polling.error && <Box color="gray.700" fontSize="sm">{polling.error}</Box>}
            <VideoTaskResult
              task={polling.task}
              isPolling={polling.isPolling}
              onCancel={(task) => { void handleCancel(task.id, task.taskType); }}
            />
            {!polling.task && !polling.isPolling && !polling.error && (
              <Box
                border="1px dashed"
                borderColor="gray.200"
                borderRadius="xl"
                p="1.5rem"
                textAlign="center"
                color="gray.600"
              >
                Create a task to see its status, output and playback here.
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
