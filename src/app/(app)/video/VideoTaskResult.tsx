'use client';

import { Box } from '@chakra-ui/react';

import { Button } from '@/components/ui/button';
import { VideoPlate } from '@/components/ui/playback-plate';
import { Spec, SpecList } from '@/components/ui/spec';

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
    <Box display="grid" gap={3} gridTemplateColumns="minmax(0, 1fr)">
      {isPolling && (
        <Box bg="surface.inset" borderRadius="md" p="1.5rem" textAlign="center" color="content.readout">
          Waiting for MiniMax to finish the task...
        </Box>
      )}

      {task && (
        <Box display="grid" gap={2} gridTemplateColumns="minmax(0, 1fr)">
          <Box display="flex" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap">
            <SpecList>
              <Spec label="Task" value={task.id} />
              <Spec label="Status" value={task.status} />
              {task.resolution && <Spec label="Resolution" value={task.resolution} />}
              {task.duration !== undefined && <Spec label="Duration" value={`${task.duration}s`} />}
              {task.ratio && <Spec label="Aspect ratio" value={task.ratio} />}
            </SpecList>
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
            <Box border="1px solid" borderColor="state.okSoft" borderRadius="md" p="0.75rem" bg="surface.sheet">
              <Box fontWeight="medium" fontSize="sm">Enhanced prompt</Box>
              <Box color="content.ink" fontSize="sm" whiteSpace="pre-wrap">{task.content.prompt}</Box>
            </Box>
          )}

          {outputUrl && (
            <Box display="grid" gap="12px">
              <VideoPlate title={`Task ${task.id}`} src={outputUrl} durationLabel={task.duration !== undefined ? `${task.duration}s` : undefined} />
              <Box display="flex" alignItems="center" justifyContent="space-between" gap="12px" flexWrap="wrap">
                <Box color="content.readout" fontSize="help" lineHeight="help" maxW="34rem">
                  MiniMax links are time limited and the exact expiry is not published. Download the file while it is available.
                </Box>
                <Button variant="outline" size="sm" onClick={() => window.open(outputUrl, '_blank', 'noopener,noreferrer')}>
                  Download
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
