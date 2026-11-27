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
import { ConsoleBand } from '@/components/ui/console-band';

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
      <ConsoleBand monogram="VA" title="Video Agent" description="Generate a video from an official MiniMax template. Pick a template, fill what it asks for, and follow the task until the clip is ready." note="Template tasks are billable and run asynchronously. The download link is valid for 9 hours." />

      <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: 'minmax(0, 0.9fr) minmax(0, 1.1fr)' }} gap={6} alignItems="start">
        <Sheet>
          <SheetHeader>
            <SheetTitle>Template</SheetTitle>
            <SheetDescription>
              {selected
                ? selected.description
                : 'Choose one of the official MiniMax Video Agent templates.'}
            </SheetDescription>
          </SheetHeader>
          <SheetContent display="grid" gap={4}>
                        <Field label="Template" htmlFor="video-agent-template">
              <Select
                              id="video-agent-template"
                              value={templateId}
                              options={templateOptions}
                              disabled={isCreating}
                              onValueChange={setTemplateId}
                            />
            </Field>

            {selected?.requiresMedia && (
                            <Field label="Image URL" htmlFor="video-agent-media">
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
                            <Field label="Text" htmlFor="video-agent-text">
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
              <Box border="1px solid" borderColor="state.okSoft" borderLeft="3px solid" borderLeftColor="state.ok" borderRadius="md" bg="surface.sheet" p="0.75rem" color="state.ok" fontSize="sm">
                {notice}
              </Box>
            )}

            <Button onClick={handleCreate} disabled={!canCreate}>
              {isCreating ? 'Creating task...' : 'Create video'}
            </Button>
          </SheetContent>
        </Sheet>

        <Sheet minH="24rem">
          <SheetHeader>
            <SheetTitle>Result</SheetTitle>
            <SheetDescription>
              {task ? 'The clip MiniMax rendered from your template.' : 'The generated clip appears here.'}
            </SheetDescription>
          </SheetHeader>
          <SheetContent display="grid" gap={4}>
            {task && (
              <SpecList>
                <Spec label="Task" value={task.taskId} />
                <Spec label="Status" value={task.status} />
              </SpecList>
            )}
            {!task && (
              <Box border="1px dashed" borderColor="surface.rule" borderRadius="xl" p="2rem" textAlign="center" color="content.readout" bg="surface.field">
                {selected
                  ? `Ready to render "${selected.name}".`
                  : 'Pick a template to start.'}
              </Box>
            )}

            {task && task.status !== 'succeeded' && (
              <Box border="1px dashed" borderColor="interaction.soft" borderRadius="xl" p="2rem" textAlign="center" color="content.readout" bg="surface.field">
                {task.status === 'failed' ? 'The task failed.' : 'MiniMax is rendering the video.'}
              </Box>
            )}

            {task?.videoUrl && (
              <Box display="grid" gap="0.5rem">
                <video src={task.videoUrl} controls style={{ width: '100%', borderRadius: '0.75rem' }} />
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
