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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
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

      <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: 'minmax(0, 1.05fr) minmax(0, 0.95fr)' }} gap={6} alignItems="start">
        <Card accent="teal">
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

        <Card accent="green" minH="16rem">
          <CardHeader>
            <CardTitle>Latest Task</CardTitle>
            <CardDescription>
              The status is polled while the task runs. Only one task is tracked at a time.
            </CardDescription>
          </CardHeader>
          <CardContent display="grid" gap={3}>
            {polling.error && <Box color="gray.700" fontSize="sm">{polling.error}</Box>}
            {!polling.task && !polling.isPolling && !polling.error && (
              <Box
                border="1px dashed"
                borderColor="gray.200"
                borderRadius="xl"
                p="1.5rem"
                textAlign="center"
                color="gray.600"
              >
                Create a task to see its status here.
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
