'use client';

/**
 * Video Studio — MiniMax H3 video workflows.
 *
 * Three bounded modes share one page: generation, H3-Context-IR prompt
 * enrichment and 2K regeneration. Exactly one task is active at a time, the
 * status is polled with a bounded serial loop, and every request is validated
 * with the same schema the server uses.
 */

import { useEffect, useRef, useState } from 'react';
import { Box } from '@chakra-ui/react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';

import { CreateVideoContextIRSchema, CreateVideoGenerationSchema, CreateVideoRegenerationSchema, VIDEO_TASK_STATUSES, VIDEO_TASK_TYPES, supportsPromptExpansionMode, type VideoModel, type VideoPromptExpansionMode, type VideoResolution, type VideoTaskDTO, type VideoTaskStatus, type VideoTaskType } from '@/application/dto/minimax/video/VideoDTO';

import { VideoMediaFields } from './VideoMediaFields';
import { VideoTaskResult } from './VideoTaskResult';
import { useVideoComposition } from './useVideoComposition';
import { useVideoTaskPolling } from './useVideoTaskPolling';
import { VideoRequestError, cancelVideoTask, createVideoTask, listVideoTasks } from './video-api';
import { EMPTY_VIDEO_MEDIA, VIDEO_MODEL_OPTIONS, VIDEO_PROMPT_EXPANSION_OPTIONS, splitMediaReferences, type VideoMediaValues, videoDurationRange, videoResolutionOptions } from './video-options';

const PROMPT_MAX_LENGTH = 7000;
const REGENERATION_PROMPT_MAX_LENGTH = 40000;

type VideoContentItem = {
  type: 'text' | 'image_url' | 'video_url' | 'audio_url';
  text?: string;
  url?: string;
  role?: string;
};

/**
 * Builds the multimodal content array shared by generation and context-ir.
 */
function buildComposition(prompt: string, media: VideoMediaValues): VideoContentItem[] {
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

  for (const url of splitMediaReferences(media.referenceImages)) {
    content.push({ type: 'image_url', url, role: 'reference_image' });
  }
  for (const url of splitMediaReferences(media.referenceVideos)) {
    content.push({ type: 'video_url', url, role: 'reference_video' });
  }
  for (const url of splitMediaReferences(media.referenceAudio)) {
    content.push({ type: 'audio_url', url, role: 'reference_audio' });
  }

  return content;
}

export default function VideoPage() {
  const [model, setModel] = useState<VideoModel>('MiniMax-H3');
  const [resolution, setResolution] = useState<VideoResolution>('2K');
  const [duration, setDuration] = useState(5);
  const [prompt, setPrompt] = useState('');
  const [promptExpansionMode, setPromptExpansionMode] = useState<VideoPromptExpansionMode>('disabled');
  const errorBannerRef = useRef<HTMLDivElement | null>(null);

  const [contextPrompt, setContextPrompt] = useState('');
  const [contextDuration, setContextDuration] = useState(5);

  const [regenerationMode, setRegenerationMode] = useState<'task' | 'video'>('task');
  const [sourceTaskId, setSourceTaskId] = useState('');
  const [baseVideo, setBaseVideo] = useState('');
  const [regenerationPrompt, setRegenerationPrompt] = useState('');
  const [regenerationMedia, setRegenerationMedia] = useState<VideoMediaValues>(EMPTY_VIDEO_MEDIA);

  const [tasks, setTasks] = useState<VideoTaskDTO[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [taskTypeFilter, setTaskTypeFilter] = useState('');

  const [isCreating, setIsCreating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorNonce, setErrorNonce] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const composition = useVideoComposition(model);
  const contextComposition = useVideoComposition('MiniMax-H3');
  const polling = useVideoTaskPolling();

  const durationRange = videoDurationRange(model);
  const resolutionOptions = videoResolutionOptions(model);

  const reportError = (message: string) => {
    setError(message);
    setErrorNonce((value) => value + 1);
  };

  const reportFailure = (caught: unknown, fallback: string) => {
    reportError(caught instanceof VideoRequestError ? caught.message : fallback);
  };

  // The banner lives above the forms, so a submit near the bottom would leave
  // the message off-screen. Bring it back into view whenever it changes —
  // including a repeated identical message, hence the nonce.
  useEffect(() => {
    if (errorNonce === 0) return;
    const node = errorBannerRef.current;
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [errorNonce]);

  const submit = async (path: Parameters<typeof createVideoTask>[0], body: unknown) => {
    setError(null);
    setNotice(null);
    setIsCreating(true);

    try {
      const result = await createVideoTask(path, body);
      polling.startPolling(result.taskId);
      setNotice(`Task ${result.taskId} was created. MiniMax is processing it.`);
    } catch (caught) {
      reportFailure(caught, 'Could not create the video task.');
    } finally {
      setIsCreating(false);
    }
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

    await submit('/api/minimax/video/generation', body);
  };

  const handleContextIR = async () => {
    const body = {
      model: 'MiniMax-H3',
      content: buildComposition(contextPrompt, contextComposition.media),
      duration: contextDuration,
      ratio: contextComposition.ratio,
    };

    const parsed = CreateVideoContextIRSchema.safeParse(body);
    if (!parsed.success) {
      reportError(parsed.error.issues.map((issue) => issue.message).join('; '));
      return;
    }

    await submit('/api/minimax/video/context-ir', body);
  };

  const handleRegeneration = async () => {
    const content = regenerationMode === 'video'
      ? [
        ...buildComposition(regenerationPrompt, regenerationMedia),
        ...(baseVideo.trim().length > 0
          ? [{ type: 'video_url' as const, url: baseVideo.trim(), role: 'base_video' }]
          : []),
      ]
      : undefined;

    const trimmedSourceTaskId = sourceTaskId.trim();
    const body = regenerationMode === 'task'
      ? {
        model: 'MiniMax-H3',
        ...(trimmedSourceTaskId.length > 0 ? { sourceTaskId: trimmedSourceTaskId } : {}),
        resolution: '2K',
      }
      : { model: 'MiniMax-H3', content, resolution: '2K' };

    const parsed = CreateVideoRegenerationSchema.safeParse(body);
    if (!parsed.success) {
      reportError(parsed.error.issues.map((issue) => issue.message).join('; '));
      return;
    }

    await submit('/api/minimax/video/regeneration', body);
  };

  const refreshTasks = async () => {
    setIsRefreshing(true);
    try {
      const result = await listVideoTasks({
        status: statusFilter ? (statusFilter as VideoTaskStatus) : undefined,
        taskType: taskTypeFilter ? (taskTypeFilter as VideoTaskType) : undefined,
      });
      setTasks(result.items);
    } catch (caught) {
      reportFailure(caught, 'Could not load the task list.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCancelTask = async (task: VideoTaskDTO) => {
    setError(null);
    try {
      const result = await cancelVideoTask(task.id, task.taskType);
      setNotice(`Task ${result.taskId} was ${result.action}.`);
      await refreshTasks();
    } catch (caught) {
      reportFailure(caught, 'Could not cancel or delete the task.');
    }
  };

  return (
    <Box display="grid" gap={6} width="100%">
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={4} flexWrap="wrap">
        <Box maxW="48rem">
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Video Studio</h1>
          <Box color="gray.600" mt={1}>
            Generate MiniMax H3 videos from text, images or multimedia references. Enrich a prompt with
            H3-Context-IR, regenerate a 768P result in 2K, and follow every task from one place.
          </Box>
        </Box>
        <Box border="1px solid" borderColor="blue.100" borderLeft="3px solid" borderLeftColor="blue.400" borderRadius="md" bg="white" p="0.75rem" color="gray.700" fontSize="sm" maxW="21rem">
          MiniMax output links are time limited and the exact expiry is not published. Download a result while it is available.
        </Box>
      </Box>

      {error && (
        <div ref={errorBannerRef}>
          <ErrorDisplay message={error} />
        </div>
      )}
      {notice && !error && (
        <Box border="1px solid" borderColor="green.100" borderLeft="3px solid" borderLeftColor="green.400" borderRadius="md" bg="white" p="0.75rem" color="green.800" fontSize="sm">
          {notice}
        </Box>
      )}

      <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: 'minmax(0, 1.05fr) minmax(0, 0.95fr)' }} gap={6} alignItems="start">
        <Box display="grid" gap={6}>
          <Card accent="blue" id="video-generation">
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

          <Card accent="purple" id="video-context-ir">
            <CardHeader>
              <CardTitle>H3-Context-IR</CardTitle>
              <CardDescription>
                MiniMax interprets the multimodal context and returns a structured, enriched prompt.
                It never creates a video.
              </CardDescription>
            </CardHeader>
            <CardContent display="grid" gap={4}>
              <Box display="grid" gap={2}>
                <Label htmlFor="video-context-ir-prompt">Prompt</Label>
                <Textarea
                  id="video-context-ir-prompt"
                  value={contextPrompt}
                  disabled={isCreating}
                  maxLength={PROMPT_MAX_LENGTH}
                  minH="7rem"
                  placeholder="Example: A captain alone before the observation window as the last fleet jumps away."
                  onChange={(event) => setContextPrompt(event.currentTarget.value)}
                />
              </Box>

              <Box display="grid" gap={4} gridTemplateColumns={{ base: '1fr', sm: '1fr 1fr' }}>
                <Box display="grid" gap={2}>
                  <Label htmlFor="video-context-ir-duration">Target duration (seconds)</Label>
                  <Input
                    id="video-context-ir-duration"
                    type="number"
                    min={4}
                    max={15}
                    value={contextDuration}
                    disabled={isCreating}
                    onChange={(event) => setContextDuration(Number(event.currentTarget.value))}
                  />
                </Box>
                <Box display="grid" gap={2}>
                  <Label htmlFor="video-context-ir-ratio">Aspect ratio</Label>
                  <Select
                    id="video-context-ir-ratio"
                    value={contextComposition.ratio}
                    options={contextComposition.ratioOptions}
                    disabled={isCreating}
                    onValueChange={(value) => contextComposition.setRatio(value as typeof contextComposition.ratio)}
                  />
                </Box>
              </Box>

              <VideoMediaFields
                idPrefix="video-context-ir"
                values={contextComposition.media}
                disabled={isCreating}
                onChange={contextComposition.updateMedia}
              />

              <Button onClick={handleContextIR} disabled={isCreating} colorPalette="purple">
                {isCreating ? 'Creating task...' : 'Enhance Prompt'}
              </Button>

              {polling.task?.taskType === 'h3_context_ir' && polling.task.content?.prompt && (
                <Box display="grid" gap={2}>
                  <Label htmlFor="video-context-ir-result">Enhanced prompt</Label>
                  <Textarea
                    id="video-context-ir-result"
                    readOnly
                    value={polling.task.content.prompt}
                    minH="10rem"
                  />
                </Box>
              )}
            </CardContent>
          </Card>

          <Card accent="teal" id="video-regeneration">
            <CardHeader>
              <CardTitle>2K Regeneration</CardTitle>
              <CardDescription>
                Regenerate a MiniMax H3 768P result in 2K, either from a source task id or from the
                768P source video itself.
              </CardDescription>
            </CardHeader>
            <CardContent display="grid" gap={4}>
              <Box display="grid" gap={2}>
                <Label htmlFor="video-regeneration-mode">Source</Label>
                <Select
                  id="video-regeneration-mode"
                  value={regenerationMode}
                  options={[
                    { value: 'task', label: 'From a source task id' },
                    { value: 'video', label: 'From a 768P base video' },
                  ]}
                  disabled={isCreating}
                  onValueChange={(value) => setRegenerationMode(value as 'task' | 'video')}
                />
              </Box>

              {regenerationMode === 'task' ? (
                <Box display="grid" gap={2}>
                  <Label htmlFor="video-regeneration-source-task-id">Source task id</Label>
                  <Input
                    id="video-regeneration-source-task-id"
                    value={sourceTaskId}
                    disabled={isCreating}
                    placeholder="424010985738629"
                    onChange={(event) => setSourceTaskId(event.currentTarget.value)}
                  />
                  <Box color="gray.600" fontSize="xs">
                    The source task must have succeeded and stay queryable for 7 days.
                  </Box>
                </Box>
              ) : (
                <Box display="grid" gap={3}>
                  <Box display="grid" gap={2}>
                    <Label htmlFor="video-regeneration-base-video">768P base video URL</Label>
                    <Input
                      id="video-regeneration-base-video"
                      value={baseVideo}
                      disabled={isCreating}
                      placeholder="https://cdn.example.com/h3-t2va-768p.mp4"
                      onChange={(event) => setBaseVideo(event.currentTarget.value)}
                    />
                    <Box color="gray.600" fontSize="xs">
                      The base video must be a MiniMax H3 768P output with an audio track, 24 fps and
                      dimensions divisible by 32.
                    </Box>
                  </Box>

                  <Box display="grid" gap={2}>
                    <Label htmlFor="video-regeneration-prompt">Prompt used for the source video</Label>
                    <Textarea
                      id="video-regeneration-prompt"
                      value={regenerationPrompt}
                      disabled={isCreating}
                      maxLength={REGENERATION_PROMPT_MAX_LENGTH}
                      minH="6rem"
                      placeholder="The final prompt sent to the model for the 768P video."
                      onChange={(event) => setRegenerationPrompt(event.currentTarget.value)}
                    />
                  </Box>

                  <VideoMediaFields
                    idPrefix="video-regeneration"
                    values={regenerationMedia}
                    disabled={isCreating}
                    onChange={(key, value) => setRegenerationMedia((current) => ({ ...current, [key]: value }))}
                  />
                </Box>
              )}

              <Button onClick={handleRegeneration} disabled={isCreating} colorPalette="teal">
                {isCreating ? 'Creating task...' : 'Regenerate in 2K'}
              </Button>
            </CardContent>
          </Card>
        </Box>

        <Box display="grid" gap={6}>
          <Card accent="green">
            <CardHeader>
              <CardTitle>Latest Task</CardTitle>
              <CardDescription>
                The status is polled while the task runs. Only one task is tracked at a time.
              </CardDescription>
            </CardHeader>
            <CardContent display="grid" gap={3}>
              {polling.error && <ErrorDisplay message={polling.error} />}
              <VideoTaskResult
                task={polling.task}
                isPolling={polling.isPolling}
                onCancel={(task) => { void handleCancelTask(task); }}
              />
              {!polling.task && !polling.isPolling && !polling.error && (
                <Box border="1px dashed" borderColor="gray.200" borderRadius="xl" p="1.5rem" textAlign="center" color="gray.600">
                  Create a task to see its status, output and playback here.
                </Box>
              )}
            </CardContent>
          </Card>

          <Card accent="gray" id="video-tasks">
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
              <CardDescription>
                MiniMax keeps task records for 7 days. Cancel a queued task or delete a finished one.
              </CardDescription>
            </CardHeader>
            <CardContent display="grid" gap={3}>
              <Box display="grid" gap={3} gridTemplateColumns={{ base: '1fr', sm: '1fr 1fr' }}>
                <Box display="grid" gap={2}>
                  <Label htmlFor="video-task-filter-status">Status</Label>
                  <Select
                    id="video-task-filter-status"
                    value={statusFilter}
                    placeholder="Any status"
                    options={[
                      { value: '', label: 'Any status' },
                      ...VIDEO_TASK_STATUSES.map((status) => ({ value: status, label: status })),
                    ]}
                    onValueChange={setStatusFilter}
                  />
                </Box>
                <Box display="grid" gap={2}>
                  <Label htmlFor="video-task-filter-type">Task type</Label>
                  <Select
                    id="video-task-filter-type"
                    value={taskTypeFilter}
                    placeholder="Any type"
                    options={[
                      { value: '', label: 'Any type' },
                      ...VIDEO_TASK_TYPES.map((type) => ({ value: type, label: type })),
                    ]}
                    onValueChange={setTaskTypeFilter}
                  />
                </Box>
              </Box>

              <Button variant="outline" colorPalette="blue" onClick={() => { void refreshTasks(); }} disabled={isRefreshing}>
                {isRefreshing ? 'Loading tasks...' : 'Refresh Tasks'}
              </Button>

              {tasks.length === 0 ? (
                <Box color="gray.600" fontSize="sm">No task loaded yet.</Box>
              ) : (
                <Box display="grid" gap={2}>
                  {tasks.map((task) => (
                    <Box
                      key={task.id}
                      border="1px solid"
                      borderColor="gray.200"
                      borderRadius="md"
                      p="0.75rem"
                      display="flex"
                      alignItems="center"
                      justifyContent="space-between"
                      gap={2}
                      flexWrap="wrap"
                    >
                      <Box fontSize="sm" color="gray.700">
                        <strong>{task.id}</strong>
                        <Box color="gray.600" fontSize="xs">
                          {task.taskType} · {task.status}
                          {task.model ? ` · ${task.model}` : ''}
                        </Box>
                      </Box>
                      {(task.status === 'queued' || task.status === 'running' || task.status === 'succeeded' || task.status === 'failed') && (
                        <Button
                          variant="outline"
                          colorPalette="red"
                          size="sm"
                          onClick={() => { void handleCancelTask(task); }}
                        >
                          {task.status === 'queued' ? 'Cancel' : 'Delete'}
                        </Button>
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}
