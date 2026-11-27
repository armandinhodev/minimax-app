'use client';

/**
 * Video tasks — browse, filter and cancel the MiniMax video tasks
 * (GET /v2/query/video_generation, DELETE /v2/video_generation/{id}).
 *
 * Its own route: /video/tasks
 */

import { useState } from 'react';
import { Box } from '@chakra-ui/react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select } from '@/components/ui/select';

import {
  VIDEO_TASK_STATUSES,
  VIDEO_TASK_TYPES,
  type VideoTaskDTO,
  type VideoTaskStatus,
  type VideoTaskType,
} from '@/application/dto/minimax/video/VideoDTO';

import { VideoMessageBanner, VideoStudioHeader } from './video-shared';
import { VideoRequestError, cancelVideoTask, listVideoTasks } from './video-api';
import { Field } from '@/components/ui/spec';

export function VideoTasksSection() {
  const [tasks, setTasks] = useState<VideoTaskDTO[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [taskTypeFilter, setTaskTypeFilter] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorNonce, setErrorNonce] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const reportError = (message: string) => {
    setError(message);
    setErrorNonce((value) => value + 1);
  };

  const refreshTasks = async () => {
    setIsRefreshing(true);
    setError(null);
    setNotice(null);

    try {
      const result = await listVideoTasks({
        status: statusFilter ? (statusFilter as VideoTaskStatus) : undefined,
        taskType: taskTypeFilter ? (taskTypeFilter as VideoTaskType) : undefined,
      });
      setTasks(result.items);
      setHasLoaded(true);
    } catch (caught) {
      reportError(
        caught instanceof VideoRequestError ? caught.message : 'Could not load the task list.',
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCancelTask = async (task: VideoTaskDTO) => {
    setError(null);
    setNotice(null);

    try {
      const result = await cancelVideoTask(task.id, task.taskType);
      setNotice(`Task ${result.taskId} was ${result.action}.`);
      await refreshTasks();
    } catch (caught) {
      reportError(
        caught instanceof VideoRequestError ? caught.message : 'Could not cancel or delete the task.',
      );
    }
  };

  return (
    <Box display="grid" gap={6} width="100%">
      <VideoStudioHeader
        title="Video Tasks"
        description="MiniMax keeps task records for 7 days. Cancel a queued task or delete a finished one."
        note="MiniMax output links are time limited and the exact expiry is not published. Download a result while it is available."
      />

      <VideoMessageBanner error={error} notice={notice} nonce={errorNonce} />

      <Sheet>
        <SheetHeader>
          <SheetTitle>Tasks</SheetTitle>
          <SheetDescription>
            MiniMax keeps task records for 7 days. Cancel a queued task or delete a finished one.
          </SheetDescription>
        </SheetHeader>
        <SheetContent display="grid" gap={3}>
          <Box display="grid" gap={3} gridTemplateColumns={{ base: '1fr', sm: '1fr 1fr' }}>
                        <Field label="Status" htmlFor="video-task-filter-status">
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
            </Field>
                        <Field label="Task type" htmlFor="video-task-filter-type">
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
            </Field>
          </Box>

          <Button variant="outline" colorPalette="blue" onClick={() => { void refreshTasks(); }} disabled={isRefreshing}>
            {isRefreshing ? 'Loading tasks...' : 'Refresh Tasks'}
          </Button>

          {!hasLoaded ? (
            <Box color="content.readout" fontSize="sm">No task loaded yet.</Box>
          ) : tasks.length === 0 ? (
            <Box color="content.readout" fontSize="sm">No task matches the current filters.</Box>
          ) : (
            <Box display="grid" gap={2}>
              {tasks.map((task) => (
                <Box
                  key={task.id}
                  border="1px solid"
                  borderColor="surface.rule"
                  borderRadius="md"
                  p="0.75rem"
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  gap={2}
                  flexWrap="wrap"
                >
                  <Box fontSize="sm" color="content.ink">
                    <strong>{task.id}</strong>
                    <Box color="content.readout" fontSize="xs">
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
        </SheetContent>
      </Sheet>
    </Box>
  );
}
