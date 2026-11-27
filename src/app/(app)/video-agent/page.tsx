'use client';

/**
 * Video Agent Studio — template based video generation.
 *
 * The template catalogue comes from MiniMax's FAQ, not from an endpoint, so
 * the app serves its own curated copy.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Box } from '@chakra-ui/react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Select, type SelectOption } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';

import { authFetch } from '@/lib/auth-client';
import { Field, Spec, SpecList } from '@/components/ui/spec';
import { AreaHeader } from '@/components/ui/area-header';
import { VideoPlate } from '@/components/ui/playback-plate';

interface Template {
  id: string;
  name: string;
  description: string;
  requiresMedia: boolean;
  requiresText: boolean;
}

interface AgentTask {
  taskId: string;
  status: 'preparing' | 'processing' | 'succeeded' | 'failed';
  videoUrl?: string;
}

const POLL_INTERVAL_MS = 5000;

export default function VideoAgentPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [textInput, setTextInput] = useState('');
  const [task, setTask] = useState<AgentTask | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const taskIdRef = useRef<string | null>(null);

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
  const textValue = textInput.trim();
  /** The primary action stays disabled until the template gets what it asks for. */
  const missingInput = selected
    ? (selected.requiresMedia && mediaValue.length === 0)
      || (selected.requiresText && textValue.length === 0)
    : true;
  const canCreate = !isCreating && !missingInput;

  const refreshTask = useCallback(async (id: string) => {
    const response = await authFetch(`/api/minimax/video-agent/generations/${encodeURIComponent(id)}`);
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(body?.error ?? `Could not read the task (HTTP ${response.status}).`);
    }
    const next = await response.json() as AgentTask;
    setTask(next);
    return next;
  }, []);

  useEffect(() => {
    const id = taskIdRef.current;
    if (!id) return;

    const timer = setInterval(() => {
      void refreshTask(id)
        .then((next) => {
          if (next.status === 'succeeded' || next.status === 'failed') {
            clearInterval(timer);
          }
        })
        .catch((caught: unknown) => {
          clearInterval(timer);
          setError(caught instanceof Error ? caught.message : 'Could not read the task.');
        });
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [refreshTask]);

  const templateOptions: SelectOption[] = templates.map((template) => ({
    value: template.id,
    label: template.name,
  }));

  const handleCreate = async () => {
    if (!templateId) {
      setError('Choose a template first.');
      return;
    }
    if (missingInput) {
      setError('Fill in what the template asks for.');
      return;
    }

    setIsCreating(true);
    setError(null);
    setNotice(null);
    setTask(null);
    taskIdRef.current = null;

    try {
      const response = await authFetch('/api/minimax/video-agent/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          mediaInputs: mediaUrl.trim() ? [{ value: mediaUrl.trim() }] : [],
          textInputs: textInput.trim() ? [{ value: textInput.trim() }] : [],
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        setError(body?.error ?? `Could not create the task (HTTP ${response.status}).`);
        return;
      }

      const created = await response.json() as { taskId: string };
      taskIdRef.current = created.taskId;
      setTask({ taskId: created.taskId, status: 'preparing' });
      setNotice(`Task ${created.taskId} created. MiniMax is processing it.`);
    } catch {
      setError('Could not reach MiniMax. Check your connection and try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Box display="grid" gap={6} gridTemplateColumns="minmax(0, 1fr)" width="100%">
      <AreaHeader title="Video Agent" description="Generate a clip from an official template." />

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
                              onValueChange={setTemplateId}
                            />
            </Field>

            {selected?.description && (
              <Box bg="surface.inset" borderRadius="md" px="12px" py="10px" color="content.readout" fontSize="label">
                {selected.description}
              </Box>
            )}

            {selected?.requiresMedia && (
                            <Field label="Image URL" required htmlFor="video-agent-media">
                <Input
                                  id="video-agent-media"
                                  value={mediaUrl}
                                  disabled={isCreating}
                                  required
                                  aria-required="true"
                                  placeholder="https://example.com/photo.jpg"
                                  onChange={(event) => setMediaUrl(event.currentTarget.value)}
                                />
                                <Box color="content.subtle" fontSize="0.78rem">
                                  JPEG, PNG or WebP. Under 20MB, shorter side over 300px, ratio between 2:5 and 5:2.
                                </Box>
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
