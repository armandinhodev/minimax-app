'use client';

/**
 * H3-Context-IR — enriches a prompt with multimodal context
 * (POST /v2/h3_context_ir). It never creates a video.
 *
 * Its own route: /video/context-ir
 */

import { useState } from 'react';
import { Box } from '@chakra-ui/react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import { CreateVideoContextIRSchema } from '@/application/dto/minimax/video/VideoDTO';

import { VideoMediaFields } from './VideoMediaFields';
import { buildComposition, VideoMessageBanner, VideoStudioHeader } from './video-shared';
import { useVideoComposition } from './useVideoComposition';
import { useVideoTaskPolling } from './useVideoTaskPolling';
import { VideoRequestError, createVideoTask } from './video-api';

const PROMPT_MAX_LENGTH = 7000;

export function VideoContextIRSection() {
  const [contextPrompt, setContextPrompt] = useState('');
  const [contextDuration, setContextDuration] = useState(5);

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorNonce, setErrorNonce] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const composition = useVideoComposition('MiniMax-H3');
  const polling = useVideoTaskPolling();

  const reportError = (message: string) => {
    setError(message);
    setErrorNonce((value) => value + 1);
  };

  const handleContextIR = async () => {
    const body = {
      model: 'MiniMax-H3',
      content: buildComposition(contextPrompt, composition.media),
      duration: contextDuration,
      ratio: composition.ratio,
    };

    const parsed = CreateVideoContextIRSchema.safeParse(body);
    if (!parsed.success) {
      reportError(parsed.error.issues.map((issue) => issue.message).join('; '));
      return;
    }

    setError(null);
    setNotice(null);
    setIsCreating(true);

    try {
      const result = await createVideoTask('/api/minimax/video/context-ir', body);
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
        title="H3-Context-IR"
        description="MiniMax interprets the multimodal context and returns a structured, enriched prompt. It never creates a video."
        note="Use the enriched prompt as the starting point of a Video Generation request."
      />

      <VideoMessageBanner error={error} notice={notice} nonce={errorNonce} />

      <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: 'minmax(0, 1.05fr) minmax(0, 0.95fr)' }} gap={6} alignItems="start">
        <Card accent="purple">
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
                  value={composition.ratio}
                  options={composition.ratioOptions}
                  disabled={isCreating}
                  onValueChange={(value) => composition.setRatio(value as typeof composition.ratio)}
                />
              </Box>
            </Box>

            <VideoMediaFields
              idPrefix="video-context-ir"
              values={composition.media}
              disabled={isCreating}
              onChange={composition.updateMedia}
            />

            <Button onClick={handleContextIR} disabled={isCreating} colorPalette="purple">
              {isCreating ? 'Creating task...' : 'Enhance Prompt'}
            </Button>
          </CardContent>
        </Card>

        <Card accent="teal" minH="16rem">
          <CardHeader>
            <CardTitle>Enhanced prompt</CardTitle>
            <CardDescription>
              The enriched prompt appears here once MiniMax finishes the task.
            </CardDescription>
          </CardHeader>
          <CardContent display="grid" gap={4}>
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

            {!polling.task && !polling.isPolling && (
              <Box
                border="1px dashed"
                borderColor="gray.200"
                borderRadius="xl"
                p="1.5rem"
                textAlign="center"
                color="gray.600"
              >
                Enhance a prompt to see the result here.
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
