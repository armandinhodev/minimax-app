'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { VideoTaskDTO, VideoTaskStatus } from '@/application/dto/minimax/video/VideoDTO';

import { VideoRequestError, queryVideoTask } from './video-api';

/** Bounded polling: the loop never runs longer than this many attempts. */
const POLL_INTERVAL_MS = 3_000;
const POLL_MAX_ATTEMPTS = 40;

const TERMINAL_STATUSES: readonly VideoTaskStatus[] = ['succeeded', 'failed', 'cancelled'];

function isTerminalStatus(status: VideoTaskStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export interface VideoTaskPolling {
  task: VideoTaskDTO | null;
  isPolling: boolean;
  error: string | null;
  startPolling: (taskId: string) => void;
  stopPolling: () => void;
  clearTask: () => void;
}

/**
 * Polls a MiniMax video task until it reaches a terminal state.
 *
 * The loop is bounded and strictly serial: one request is in flight at a time,
 * the next attempt is only scheduled once the previous one resolved, and both
 * the timer and the in-flight request are cleaned up when the page unmounts.
 */
export function useVideoTaskPolling(): VideoTaskPolling {
  const [task, setTask] = useState<VideoTaskDTO | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    abortRef.current?.abort();
    abortRef.current = null;
    setIsPolling(false);
  }, []);

  const clearTask = useCallback(() => {
    setTask(null);
    setError(null);
  }, []);

  const startPolling = useCallback((taskId: string) => {
    stopPolling();
    setError(null);
    setTask(null);

    const controller = new AbortController();
    abortRef.current = controller;
    setIsPolling(true);

    const run = async (attempt: number): Promise<void> => {
      if (controller.signal.aborted || !mountedRef.current) return;

      try {
        const response = await queryVideoTask(taskId, controller.signal);
        if (controller.signal.aborted || !mountedRef.current) return;

        setTask(response.task);

        if (isTerminalStatus(response.task.status)) {
          setIsPolling(false);
          abortRef.current = null;
          return;
        }
      } catch (caught) {
        if (controller.signal.aborted || !mountedRef.current) return;

        setError(
          caught instanceof VideoRequestError
            ? caught.message
            : 'Could not read the task status. Please try again.',
        );
        setIsPolling(false);
        abortRef.current = null;
        return;
      }

      if (attempt + 1 >= POLL_MAX_ATTEMPTS) {
        setError('The task is still running. Check the task list for the latest status.');
        setIsPolling(false);
        abortRef.current = null;
        return;
      }

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void run(attempt + 1);
      }, POLL_INTERVAL_MS);
    };

    void run(0);
  }, [stopPolling]);

  return { task, isPolling, error, startPolling, stopPolling, clearTask };
}
