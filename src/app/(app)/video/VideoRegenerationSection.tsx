'use client';

/**
 * 2K Regeneration — re-renders a MiniMax H3 768P result in 2K
 * (POST /v2/video_regeneration).
 *
 * Its own route: /video/regeneration
 */

import { useState } from 'react';
import { Box } from '@chakra-ui/react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Field } from '@/components/ui/spec';
import { StatusLamp } from '@/components/ui/status-lamp';
import { Textarea } from '@/components/ui/textarea';

import { CreateVideoRegenerationSchema } from '@/application/dto/minimax/video/VideoDTO';

import { VideoMediaFields } from './VideoMediaFields';
import { buildComposition, VideoMessageBanner, VideoStudioHeader } from './video-shared';
import { useVideoTaskPolling } from './useVideoTaskPolling';
import { VideoRequestError, createVideoTask } from './video-api';
import { EMPTY_VIDEO_MEDIA, type VideoMediaValues } from './video-options';

const REGENERATION_PROMPT_MAX_LENGTH = 40000;

export function VideoRegenerationSection() {
  const [regenerationMode, setRegenerationMode] = useState<'task' | 'video'>('task');
  const [sourceTaskId, setSourceTaskId] = useState('');
  const [baseVideo, setBaseVideo] = useState('');
  const [regenerationPrompt, setRegenerationPrompt] = useState('');
  const [regenerationMedia, setRegenerationMedia] = useState<VideoMediaValues>(EMPTY_VIDEO_MEDIA);

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorNonce, setErrorNonce] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const polling = useVideoTaskPolling();

  const reportError = (message: string) => {
    setError(message);
    setErrorNonce((value) => value + 1);
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

    const body = regenerationMode === 'task'
      ? {
        model: 'MiniMax-H3',
        ...(sourceTaskId.trim().length > 0 ? { sourceTaskId: sourceTaskId.trim() } : {}),
        resolution: '2K',
      }
      : { model: 'MiniMax-H3', content, resolution: '2K' };

    const parsed = CreateVideoRegenerationSchema.safeParse(body);
    if (!parsed.success) {
      reportError(parsed.error.issues.map((issue) => issue.message).join('; '));
      return;
    }

    setError(null);
    setNotice(null);
    setIsCreating(true);

    try {
      const result = await createVideoTask('/api/minimax/video/regeneration', body);
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

  return (
    <Box display="grid" gap={6} width="100%">
      <VideoStudioHeader
        title="2K Regeneration"
        description="Regenerate a MiniMax H3 768P result in 2K, either from a source task id or from the 768P source video itself."
        note="Only MiniMax-H3 reaches 2K. The source must be a 768P output with an audio track."
      />

      <VideoMessageBanner error={error} notice={notice} nonce={errorNonce} />

      <Box
        display="grid"
        gridTemplateColumns={{ base: '1fr', xl: 'minmax(0, 1.15fr) minmax(0, 0.85fr)' }}
        gap={6}
        alignItems="start"
      >
        <Sheet>
          <SheetHeader>
            <SheetTitle>Parameters</SheetTitle>
            <SheetDescription>
              Either a source task id or the 768P source video itself.
            </SheetDescription>
          </SheetHeader>
          <SheetContent display="grid" gap={0}>
            <Field label="Source">
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
            </Field>

            {regenerationMode === 'task' ? (
              <Field label="Source task id">
                <Box display="grid" gap={1}>
                  <Input
                    id="video-regeneration-source-task-id"
                    value={sourceTaskId}
                    disabled={isCreating}
                    placeholder="424010985738629"
                    onChange={(event) => setSourceTaskId(event.currentTarget.value)}
                  />
                  <Box color="content.subtle" fontSize="label" lineHeight="label">
                    The source task must have succeeded and stay queryable for 7 days.
                  </Box>
                </Box>
              </Field>
            ) : (
              <>
                <Field label="768P base video URL">
                  <Box display="grid" gap={1}>
                    <Input
                      id="video-regeneration-base-video"
                      value={baseVideo}
                      disabled={isCreating}
                      placeholder="https://cdn.example.com/h3-t2va-768p.mp4"
                      onChange={(event) => setBaseVideo(event.currentTarget.value)}
                    />
                    <Box color="content.subtle" fontSize="label" lineHeight="label">
                      The base video must be a MiniMax H3 768P output with an audio track, 24 fps and
                      dimensions divisible by 32.
                    </Box>
                  </Box>
                </Field>

                <Box display="grid" gap={2} py={3} borderBottom="1px solid" borderColor="surface.rule">
                  <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
                    <Label htmlFor="video-regeneration-prompt">Prompt used for the source video</Label>
                    <Box as="span" color="content.subtle" fontSize="label" lineHeight="label">
                      {regenerationPrompt.length}/{REGENERATION_PROMPT_MAX_LENGTH}
                    </Box>
                  </Box>
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

                <Box display="grid" gap={2} pt={3}>
                  <Label>Media references</Label>
                  <VideoMediaFields
                    idPrefix="video-regeneration"
                    values={regenerationMedia}
                    disabled={isCreating}
                    onChange={(key, value) => setRegenerationMedia((current) => ({ ...current, [key]: value }))}
                  />
                </Box>
              </>
            )}

            <Box pt={4}>
              <Button onClick={handleRegeneration} disabled={isCreating}>
                {isCreating ? 'Creating task' : 'Regenerate in 2K'}
              </Button>
            </Box>
          </SheetContent>
        </Sheet>

        <Sheet>
          <SheetHeader>
            <SheetTitle>Latest task</SheetTitle>
            <SheetDescription>
              The status is polled while the task runs. Only one task is tracked at a time.
            </SheetDescription>
          </SheetHeader>
          <SheetContent display="grid" gap={3}>
            {polling.task && (
              <StatusLamp state={polling.task.status} detail={polling.task.id} />
            )}

            {polling.error && (
              <Box color="state.err" fontSize="body" lineHeight="body">{polling.error}</Box>
            )}

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
                Create a task to see its status here.
              </Box>
            )}
          </SheetContent>
        </Sheet>
      </Box>
    </Box>
  );
}
