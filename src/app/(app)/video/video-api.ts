'use client';

/**
 * Browser-side API client for the video routes.
 *
 * Every call goes through the shared `authFetch` helper, so the app access
 * key never leaves the browser session storage.
 */

import { authFetch, parseApiError } from '@/lib/auth-client';
import type { VideoTaskDTO, VideoTaskStatus, VideoTaskType } from '@/application/dto/VideoDTO';

export class VideoRequestError extends Error {
  constructor(message: string, readonly code: number | null) {
    super(message);
    this.name = 'VideoRequestError';
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(url, init);

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new VideoRequestError(
      error?.message ?? `Request failed with HTTP ${response.status}`,
      error?.code ?? response.status,
    );
  }

  return response.json() as Promise<T>;
}

export function createVideoTask(
  path: '/api/minimax/video/generation' | '/api/minimax/video/context-ir' | '/api/minimax/video/regeneration',
  body: unknown,
): Promise<{ taskId: string }> {
  return requestJson<{ taskId: string }>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function queryVideoTask(
  taskId: string,
  signal?: AbortSignal,
): Promise<{ task: VideoTaskDTO }> {
  return requestJson<{ task: VideoTaskDTO }>(
    `/api/minimax/video/tasks/${encodeURIComponent(taskId)}`,
    { signal },
  );
}

export interface VideoTaskListFilters {
  status?: VideoTaskStatus;
  taskType?: VideoTaskType;
  page?: number;
  pageSize?: number;
}

export function listVideoTasks(
  filters: VideoTaskListFilters = {},
): Promise<{ items: VideoTaskDTO[]; total: number }> {
  const search = new URLSearchParams();

  if (filters.status) search.set('status', filters.status);
  if (filters.taskType) search.set('taskType', filters.taskType);
  if (filters.page) search.set('page', String(filters.page));
  if (filters.pageSize) search.set('pageSize', String(filters.pageSize));

  const query = search.toString();
  return requestJson<{ items: VideoTaskDTO[]; total: number }>(
    `/api/minimax/video/tasks${query ? `?${query}` : ''}`,
  );
}

export function cancelVideoTask(
  taskId: string,
  taskType?: VideoTaskType,
): Promise<{ taskId: string; action: 'cancelled' | 'deleted'; status: string }> {
  const query = taskType ? `?taskType=${encodeURIComponent(taskType)}` : '';
  return requestJson<{ taskId: string; action: 'cancelled' | 'deleted'; status: string }>(
    `/api/minimax/video/tasks/${encodeURIComponent(taskId)}${query}`,
    { method: 'DELETE' },
  );
}
