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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Field } from '@/components/ui/spec';
import { StatusLamp } from '@/components/ui/status-lamp';
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

  const enhancedPrompt = polling.task?.taskType === 'h3_context_ir'
    ? polling.task.content?.prompt
    : undefined;

  return (
    <Box display="grid" gap={6} width="100%">
      <VideoStudioHeader
        title="H3-Context-IR"
        description="MiniMax interprets the multimodal context and returns a structured, enriched prompt. It never creates a video."
        note="Use the enriched prompt as the starting point of a Video Generation request."
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
              The context MiniMax reads to enrich the prompt.
            </SheetDescription>
          </SheetHeader>
          <SheetContent display="grid" gap={0}>
            <Box display="grid" gap={2} py={3} borderBottom="1px solid" borderColor="surface.rule">
              <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
                <Label htmlFor="video-context-ir-prompt">Prompt</Label>
                <Box as="span" color="content.subtle" fontSize="label" lineHeight="label">
                  {contextPrompt.length}/{PROMPT_MAX_LENGTH}
                </Box>
              </Box>
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

            <Field label="Target duration (seconds)" htmlFor="video-context-ir-duration">
              <Input
                id="video-context-ir-duration"
                type="number"
                min={4}
                max={15}
                value={contextDuration}
                disabled={isCreating}
                onChange={(event) => setContextDuration(Number(event.currentTarget.value))}
              />
            </Field>

            <Field label="Aspect ratio" htmlFor="video-context-ir-ratio">
              <Select
                id="video-context-ir-ratio"
                value={composition.ratio}
                options={composition.ratioOptions}
                disabled={isCreating}
                onValueChange={(value) => composition.setRatio(value as typeof composition.ratio)}
              />
            </Field>

            <Box display="grid" gap={2} pt={3}>
              <Label>Media references</Label>
              <VideoMediaFields
                idPrefix="video-context-ir"
                values={composition.media}
                disabled={isCreating}
                onChange={composition.updateMedia}
              />
            </Box>

            <Box pt={4}>
              <Button onClick={handleContextIR} disabled={isCreating}>
                {isCreating ? 'Creating task' : 'Enhance prompt'}
              </Button>
            </Box>
          </SheetContent>
        </Sheet>

        <Sheet>
          <SheetHeader>
            <SheetTitle>Enhanced prompt</SheetTitle>
            <SheetDescription>
              The enriched prompt appears here once MiniMax finishes the task.
            </SheetDescription>
          </SheetHeader>
          <SheetContent display="grid" gap={3}>
            {polling.task && (
              <StatusLamp state={polling.task.status} detail={polling.task.id} />
            )}

            {polling.error && (
              <Box color="state.err" fontSize="body" lineHeight="body">{polling.error}</Box>
            )}

            {enhancedPrompt ? (
              <Textarea
                id="video-context-ir-result"
                readOnly
                value={enhancedPrompt}
                minH="12rem"
              />
            ) : (
              !polling.task && !polling.isPolling && (
                <Box
                  border="1px dashed"
                  borderColor="surface.rule"
                  borderRadius="lg"
                  p="1.5rem"
                  textAlign="center"
                  color="content.subtle"
                  fontSize="body"
                >
                  Enhance a prompt to see the result here.
                </Box>
              )
            )}
          </SheetContent>
        </Sheet>
      </Box>
    </Box>
  );
}
