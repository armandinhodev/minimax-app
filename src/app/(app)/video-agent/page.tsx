'use client';

/**
 * Video Agent Studio — template based video generation.
 *
 * The template catalogue comes from MiniMax's FAQ, not from an endpoint, so
 * the app serves its own curated copy.
 */

import { useEffect, useRef, useState } from 'react';
import { ScreenResetButton } from '@/components/shared/ScreenResetButton';
import { useScreenState } from '@/components/shared/screen-state';
import { Box } from '@chakra-ui/react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, type SelectOption } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';

import { authFetch, parseApiError } from '@/lib/auth-client';
import { Field, Spec, SpecList } from '@/components/ui/spec';
import { AreaHeader } from '@/components/ui/area-header';
import { VideoPlate } from '@/components/ui/playback-plate';

import { VideoAgentImageInput } from './VideoAgentImageInput';
import { encodeVideoAgentImage, validateVideoAgentImageReference } from './video-agent-image';

interface Template {
  id: string;
  name: string;
  description: string;
  requiresMedia: boolean;
  requiresText: boolean;
  mediaCount: number;
}

interface AgentTask {
  taskId: string;
  status: 'preparing' | 'processing' | 'succeeded' | 'failed';
  videoUrl?: string;
}

const POLL_INTERVAL_MS = 5000;

async function describeAgentError(response: Response, fallback: string): Promise<string> {
  const error = await parseApiError(response);
  if (error?.code === 2013) {
    const detail = typeof error.details?.upstreamMessage === 'string' && /input count not match/i.test(error.details.upstreamMessage)
      ? ` MiniMax said: ${error.details.upstreamMessage}.`
      : '';
    return `MiniMax rejected the inputs (2013).${detail} Check the template’s required text and image count. For images, use the original files or a public URL.`;
  }
  if (error?.code === 1008) return 'MiniMax reports insufficient balance (1008).';
  if (error?.code === 1004 || error?.code === 2049) return `MiniMax rejected the API credentials (${error.code}).`;
  if (error?.code === 1002) return 'MiniMax rate-limited the request (1002). Try again shortly.';
  return error?.code ? `${error.message ?? fallback} (MiniMax code ${error.code})` : (error?.message ?? fallback);
}

export default function VideoAgentPage() {
  const [templates, setTemplates] = useScreenState<Template[]>('video-agent:templates', []);
  const [templateId, setTemplateId] = useScreenState('video-agent:templateId', '');
  const [mediaUrl, setMediaUrl] = useScreenState('video-agent:mediaUrl', '');
  const [mediaFiles, setMediaFiles] = useScreenState<File[]>('video-agent:mediaFiles', []);
  const [textInput, setTextInput] = useScreenState('video-agent:textInput', '');
  const [task, setTask] = useScreenState<AgentTask | null>('video-agent:task', null);
  const [isCreating, setIsCreating] = useScreenState('video-agent:isCreating', false);
  // The poll loop dies with the page, so it stays local and keeps Reset off.
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useScreenState<string | null>('video-agent:error', null);
  const [notice, setNotice] = useScreenState<string | null>('video-agent:notice', null);
  const creatingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadTemplates() {
      try {
        const response = await authFetch('/api/minimax/video-agent/templates');
        if (!response.ok) return;
        const data = await response.json() as { templates?: Template[] };
        if (cancelled) return;
        const list = data.templates ?? [];
        setTemplates(list);
        if (list.length > 0) setTemplateId(list[0].id);
      } catch {
        // The template list is a convenience: the form still accepts a raw ID.
      }
    }

    void loadTemplates();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = templates.find((template) => template.id === templateId);
  const mediaValue = mediaUrl.trim();
  const mediaCount = selected?.mediaCount ?? 0;
  const urlError = validateVideoAgentImageReference(mediaValue);
  const textValue = textInput.trim();
  const mediaReady = mediaCount === 0 || (mediaCount === 1
    ? mediaFiles.length > 0 || (mediaValue.length > 0 && !urlError)
    : mediaFiles.length === mediaCount);
  /** The primary action stays disabled until the template gets what it asks for. */
  const missingInput = selected
    ? (selected.requiresMedia && !mediaReady)
      || (selected.requiresText && textValue.length === 0)
    : true;
  const pendingTaskId = task?.status === 'preparing' || task?.status === 'processing' ? task.taskId : null;
  const canCreate = !isCreating && !pendingTaskId && !missingInput;

  useEffect(() => {
    if (!pendingTaskId) {
      setIsPolling(false);
      return;
    }

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    setIsPolling(true);

    const refreshTask = async () => {
      try {
        const response = await authFetch(`/api/minimax/video-agent/generations/${encodeURIComponent(pendingTaskId)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(await describeAgentError(response, 'Could not read the task.'));
        const next = await response.json() as AgentTask;
        if (controller.signal.aborted) return;
        setTask(next);
        if (next.status === 'preparing' || next.status === 'processing') {
          timer = setTimeout(() => void refreshTask(), POLL_INTERVAL_MS);
        }
      } catch (caught) {
        if (controller.signal.aborted) return;
        setIsPolling(false);
        setError(caught instanceof Error ? caught.message : 'Could not read the task.');
      }
    };

    timer = setTimeout(() => void refreshTask(), POLL_INTERVAL_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [pendingTaskId, setError, setTask]);

  const templateOptions: SelectOption[] = templates.map((template) => ({
    value: template.id,
    label: template.name,
  }));

  const handleCreate = async () => {
    if (creatingRef.current || !canCreate) return;
    creatingRef.current = true;
    setIsCreating(true);
    setError(null);
    setNotice(null);
    setTask(null);

    try {
      let images: string[] = [];
      if (selected?.requiresMedia) {
        try {
          images = mediaCount === 1 && mediaValue && mediaFiles.length === 0
            ? [mediaValue]
            : await Promise.all(mediaFiles.map((file) => encodeVideoAgentImage(file)));
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : 'Could not prepare the image.');
          return;
        }
      }
      const response = await authFetch('/api/minimax/video-agent/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          mediaInputs: images.map((value) => ({ value })),
          textInputs: selected?.requiresText && textValue ? [{ value: textValue }] : [],
        }),
      });

      if (!response.ok) {
        setError(await describeAgentError(response, `Could not create the task (HTTP ${response.status}).`));
        return;
      }

      const created = await response.json() as { taskId: string };
      setTask({ taskId: created.taskId, status: 'preparing' });
      setNotice(`Task ${created.taskId} created. MiniMax is processing it.`);
    } catch {
      setError('Could not reach MiniMax. Check your connection and try again.');
    } finally {
      creatingRef.current = false;
      setIsCreating(false);
    }
  };

  return (
    <Box display="grid" gap={6} gridTemplateColumns="minmax(0, 1fr)" width="100%">
      <AreaHeader
        title="Video Agent"
        description="Generate a clip from an official template."
        actions={<ScreenResetButton namespace="video-agent" disabled={isCreating || isPolling} />}
      />

      <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: 'minmax(0, 7fr) minmax(0, 5fr)' }} gap={4} alignItems="start">
        <Sheet>
          <SheetHeader icon="video-agent">
            <SheetTitle>Template brief</SheetTitle>
            <SheetDescription>Required inputs follow the selected template.</SheetDescription>
          </SheetHeader>
          <SheetContent display="grid" gap={4}>
            {(selected?.requiresMedia || selected?.requiresText) && (
              <Box color="content.subtle" fontSize="label" lineHeight="label">
                Fields marked * are required.
              </Box>
            )}

                        <Field label="Template" htmlFor="video-agent-template">
              <Select
                              id="video-agent-template"
                              value={templateId}
                              options={templateOptions}
                              disabled={isCreating}
                              onValueChange={(value) => {
                                setTemplateId(value);
                                setMediaUrl('');
                                setMediaFiles([]);
                                setError(null);
                              }}
                            />
            </Field>

            {selected?.description && (
              <Box bg="surface.inset" borderRadius="md" px="12px" py="10px" color="content.readout" fontSize="label">
                {selected.description}
              </Box>
            )}

            {selected?.requiresMedia && (
              <Field label="Image" required htmlFor="video-agent-media">
                <VideoAgentImageInput
                  mediaCount={selected.mediaCount}
                  url={mediaUrl}
                  files={mediaFiles}
                  urlError={urlError}
                  disabled={isCreating}
                  onUrlChange={(value) => {
                    setMediaFiles([]);
                    setMediaUrl(value);
                    setError(null);
                  }}
                  onFilesChange={(files) => {
                    setMediaUrl('');
                    setMediaFiles(files);
                    setError(null);
                  }}
                />
              </Field>
            )}

            {selected?.requiresText && (
                            <Field label="Text" required htmlFor="video-agent-text">
                <Textarea
                                  id="video-agent-text"
                                  value={textInput}
                                  disabled={isCreating}
                                  required
                                  aria-required="true"
                                  minH="6rem"
                                  placeholder="Describe the scene you want to play."
                                  onChange={(event) => setTextInput(event.currentTarget.value)}
                                />
              </Field>
            )}

            {error && <ErrorDisplay message={error} />}
            {notice && !error && (
              <Box borderRadius="md" bg="state.okSoft" px="12px" py="10px" color="content.ink" fontSize="label">
                {notice}
              </Box>
            )}

            <Button onClick={handleCreate} disabled={!canCreate}>
              {isCreating ? 'Creating task...' : 'Create video'}
            </Button>
          </SheetContent>
        </Sheet>

        <Sheet minH="24rem">
          <SheetHeader icon="folder">
            <SheetTitle>Result</SheetTitle>
            <SheetDescription>Preview the generated clip.</SheetDescription>
          </SheetHeader>
          <SheetContent display="grid" gap={4}>
            {task && (
              <SpecList>
                <Spec label="Task" value={task.taskId} />
                <Spec label="Status" value={task.status} />
              </SpecList>
            )}
            {!task && (
              <Box borderRadius="md" p="2rem" textAlign="center" color="content.readout" bg="surface.inset">
                {selected
                  ? `Ready to render "${selected.name}".`
                  : 'Pick a template to start.'}
              </Box>
            )}

            {task && task.status !== 'succeeded' && (
              <Box borderRadius="md" p="2rem" textAlign="center" color="content.readout" bg="surface.inset">
                {task.status === 'failed' ? 'The task failed.' : 'MiniMax is rendering the video.'}
              </Box>
            )}

            {task?.videoUrl && (
              <Box display="grid" gap="0.5rem">
                <VideoPlate title="Generated clip" src={task.videoUrl} />
                <Box color="content.subtle" fontSize="0.78rem">
                  The link expires 9 hours after the task completed.
                </Box>
              </Box>
            )}
          </SheetContent>
        </Sheet>
      </Box>
    </Box>
  );
}
