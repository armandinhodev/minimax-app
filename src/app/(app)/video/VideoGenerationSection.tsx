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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Plate } from '@/components/ui/plate';
import { Field } from '@/components/ui/spec';
import { JobStrip } from '@/components/ui/job-strip';
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
    <Box display="grid" gap={6} gridTemplateColumns="minmax(0, 1fr)" width="100%">
      <VideoStudioHeader
        title="Video Generation"
        description="Create a MiniMax H3 video from text, images or multimedia references."
        note="MiniMax output links are time limited and the exact expiry is not published. Download a result while it is available."
        readoutsLabel="Request"
        readouts={[
          { label: 'Model', value: model },
          { label: 'Resolution', value: resolution },
          { label: 'Duration', value: `${duration}s` },
          { label: 'Aspect ratio', value: composition.ratio },
        ]}
      />

      <VideoMessageBanner error={error} notice={notice} nonce={errorNonce} />

      <Box
        display="grid"
        gridTemplateColumns={{ base: '1fr', xl: 'minmax(0, 7fr) minmax(0, 5fr)' }}
        gap={0}
        alignItems="start"
      >
        <Sheet>
          <SheetHeader>
            <SheetTitle>Parameters</SheetTitle>
            <SheetDescription>
              Text-to-video, image-to-video or reference-to-video.
            </SheetDescription>
          </SheetHeader>
          <SheetContent display="grid" gap={0}>
            <Field label="Model" htmlFor="video-generation-model">
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
            </Field>

            <Field label="Resolution" htmlFor="video-generation-resolution">
              <Select
                id="video-generation-resolution"
                value={resolution}
                options={resolutionOptions}
                disabled={isCreating}
                onValueChange={(value) => setResolution(value as VideoResolution)}
              />
            </Field>

            <Field label="Duration (seconds)" htmlFor="video-generation-duration">
              <Input
                id="video-generation-duration"
                type="number"
                min={durationRange.min}
                max={durationRange.max}
                value={duration}
                disabled={isCreating}
                onChange={(event) => setDuration(Number(event.currentTarget.value))}
              />
            </Field>

            <Field label="Aspect ratio" htmlFor="video-generation-ratio">
              <Select
                id="video-generation-ratio"
                value={composition.ratio}
                options={composition.ratioOptions}
                disabled={isCreating}
                onValueChange={(value) => composition.setRatio(value as typeof composition.ratio)}
              />
            </Field>

            {supportsPromptExpansionMode(model) && (
              <Field label="Prompt expansion" htmlFor="video-generation-prompt-expansion">
                <Select
                  id="video-generation-prompt-expansion"
                  value={promptExpansionMode}
                  options={VIDEO_PROMPT_EXPANSION_OPTIONS}
                  disabled={isCreating}
                  onValueChange={(value) => setPromptExpansionMode(value as VideoPromptExpansionMode)}
                />
              </Field>
            )}

            <Box display="grid" gap={2} py={3} borderBottom="1px solid" borderColor="surface.rule">
              <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
                <Label htmlFor="video-generation-prompt">Prompt</Label>
                <Box as="span" color="content.subtle" fontSize="label" lineHeight="label">
                  {prompt.length}/{PROMPT_MAX_LENGTH}
                </Box>
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

            <Box display="grid" gap={2} pt={3}>
              <Label>Media references</Label>
              <VideoMediaFields
                idPrefix="video-generation"
                values={composition.media}
                disabled={isCreating}
                onChange={composition.updateMedia}
              />
            </Box>

            <Box pt={4}>
              <Button onClick={handleGenerate} disabled={isCreating}>
                {isCreating ? 'Creating task' : 'Generate video'}
              </Button>
            </Box>
          </SheetContent>
        </Sheet>

        <Plate
          title="Latest task"
          description="The status is polled while the task runs. Only one task is tracked at a time."
        >
          {polling.task && (
            <JobStrip
              state={polling.task.status}
              detail={polling.task.id}
            />
          )}

          {polling.error && (
            <Box color="state.err" fontSize="body" lineHeight="body" mt={3}>{polling.error}</Box>
          )}

          <Box mt={3}>
            <VideoTaskResult
              task={polling.task}
              isPolling={polling.isPolling}
              onCancel={(task) => { void handleCancel(task.id, task.taskType); }}
            />
          </Box>

          {!polling.task && !polling.isPolling && !polling.error && (
            <Box
              border="1px dashed"
              borderColor="surface.rule"
              borderRadius="lg"
              p="1.5rem"
              textAlign="center"
              color="content.subtle"
              fontSize="body"
            >
              Create a task to see its status, output and playback here.
            </Box>
          )}
        </Plate>
      </Box>
    </Box>
  );
}
