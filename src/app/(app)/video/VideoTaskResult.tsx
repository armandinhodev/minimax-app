'use client';

import { Box } from '@chakra-ui/react';

import { Button } from '@/components/ui/button';

import { isSafeHttpUrl, type VideoTaskDTO } from '@/application/dto/minimax/video/VideoDTO';

export interface VideoTaskResultProps {
  task: VideoTaskDTO | null;
  isPolling: boolean;
  onCancel?: (task: VideoTaskDTO) => void;
}

/**
 * Renders the outcome of the active task.
 *
 * The provider link is only embedded when it is a valid http(s) URL, and the
 * panel states that MiniMax links are time limited without inventing an
 * expiry that the API never publishes.
 */
export function VideoTaskResult({ task, isPolling, onCancel }: VideoTaskResultProps) {
  if (!task && !isPolling) return null;

  const outputUrl = task?.content?.url && isSafeHttpUrl(task.content.url)
    ? task.content.url
    : undefined;

  return (
    <Box display="grid" gap={3}>
      {isPolling && (
        <Box border="1px dashed" borderColor="interaction.soft" borderRadius="xl" p="1.5rem" textAlign="center" color="content.readout">
          Waiting for MiniMax to finish the task...
        </Box>
      )}

      {task && (
        <Box display="grid" gap={2}>
          <Box display="flex" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap">
            <Box color="content.ink" fontSize="sm">
              {task.id} · {task.status}
              {task.resolution ? ` · ${task.resolution}` : ''}
              {task.duration !== undefined ? ` · ${task.duration}s` : ''}
              {task.ratio ? ` · ${task.ratio}` : ''}
            </Box>
            {onCancel && (task.status === 'queued' || task.status === 'running') && (
              <Button variant="outline" colorPalette="red" size="sm" onClick={() => onCancel(task)}>
                Cancel task
              </Button>
            )}
          </Box>

          {task.status === 'failed' && task.error?.message && (
            <Box border="1px solid" borderColor="state.errSoft" borderRadius="md" p="0.75rem" color="state.err" fontSize="sm">
              {task.error.code !== undefined ? `${task.error.code}: ` : ''}{task.error.message}
            </Box>
          )}

          {task.status === 'succeeded' && task.content?.prompt && (
            <Box border="1px solid" borderColor="state.okSoft" borderRadius="md" p="0.75rem" bg="white">
              <Box fontWeight="medium" fontSize="sm">Enhanced prompt</Box>
              <Box color="content.ink" fontSize="sm" whiteSpace="pre-wrap">{task.content.prompt}</Box>
            </Box>
          )}

          {outputUrl && (
            <Box border="1px solid" borderColor="state.okSoft" borderRadius="xl" overflow="hidden" bg="white">
              <video
                data-testid="video-output"
                src={outputUrl}
                controls
                preload="metadata"
                style={{ width: '100%', display: 'block', backgroundColor: 'var(--chakra-colors-surface.field)' }}
              />
              <Box display="flex" alignItems="center" justifyContent="space-between" gap={2} p="0.75rem" flexWrap="wrap">
                <Box color="content.readout" fontSize="xs">
                  MiniMax links are time limited and the exact expiry is not published. Download the file while it is available.
                </Box>
                <Button
                  variant="outline"
                  colorPalette="green"
                  size="sm"
                  onClick={() => window.open(outputUrl, '_blank', 'noopener,noreferrer')}
                >
                  Open
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
