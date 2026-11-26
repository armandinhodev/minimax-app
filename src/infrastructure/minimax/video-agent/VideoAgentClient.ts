/**
 * MiniMax Video Agent client.
 * @server-only — this module must never be bundled for the browser.
 *
 * Creating a template task is billable and asynchronous, so the client never
 * retries: a retry could charge twice for the same task.
 */

import 'server-only';

import {
  normalizeVideoAgentStatus,
  type CreateVideoAgentTaskRequest,
  type VideoAgentTaskCreatedDTO,
  type VideoAgentTaskDTO,
} from '@/application/dto/minimax/video-agent/VideoAgentDTO';
import type { IVideoAgentClient } from '@/domain/interfaces/minimax/video-agent/IVideoAgentClient';

import { MINIMAX_BASE_URL, buildAuthHeader, parseMiniMaxError, requireMiniMaxApiKey } from '../MiniMaxConfig';
import { readResponseBodyOnce } from '../retry-utils';

const CREATE_PATH = '/v1/video_template_generation';
const QUERY_PATH = '/v1/query/video_template_generation';
const CREATE_TIMEOUT_MS = 60_000;
const QUERY_TIMEOUT_MS = 30_000;

export class MiniMaxVideoAgentError extends Error {
  constructor(
    message: string,
    readonly code: number,
    readonly status: number,
  ) {
    super(message);
    this.name = 'MiniMaxVideoAgentError';
  }
}

function normalizeError(error: { code: number; message: string; status?: number }): MiniMaxVideoAgentError {
  return new MiniMaxVideoAgentError(error.message, error.code, error.status ?? 502);
}

function readTaskId(payload: unknown): string {
  const raw = payload as Record<string, unknown> | undefined;
  const taskId = typeof raw?.task_id === 'string' ? raw.task_id.trim() : '';
  if (!taskId) {
    throw new MiniMaxVideoAgentError('MiniMax did not return a task ID', 0, 502);
  }
  return taskId;
}

export class VideoAgentClient implements IVideoAgentClient {
  private readonly apiKey: string;

  constructor() {
    this.apiKey = requireMiniMaxApiKey();
  }

  async createTemplateTask(request: CreateVideoAgentTaskRequest): Promise<VideoAgentTaskCreatedDTO> {
    const body: Record<string, unknown> = {
      template_id: request.templateId,
    };

    if (request.textInputs.length > 0) {
      body.text_inputs = request.textInputs.map((input) => ({ value: input.value }));
    }
    if (request.mediaInputs.length > 0) {
      body.media_inputs = request.mediaInputs.map((input) => ({ value: input.value }));
    }
    if (request.callbackUrl) {
      body.callback_url = request.callbackUrl;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CREATE_TIMEOUT_MS);

    try {
      const response = await fetch(`${MINIMAX_BASE_URL}${CREATE_PATH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: buildAuthHeader(this.apiKey),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await readResponseBodyOnce(response);
        throw normalizeError(parseMiniMaxError(response, errorBody));
      }

      const payload = await response.json();
      const baseResp = (payload as Record<string, unknown> | undefined)?.base_resp as
        | Record<string, unknown>
        | undefined;
      if (baseResp && typeof baseResp.status_code === 'number' && baseResp.status_code !== 0) {
        throw new MiniMaxVideoAgentError(
          typeof baseResp.status_msg === 'string' && baseResp.status_msg.length > 0
            ? baseResp.status_msg
            : 'MiniMax Video Agent request failed',
          baseResp.status_code,
          baseResp.status_code >= 400 && baseResp.status_code < 600 ? baseResp.status_code : 502,
        );
      }

      return { taskId: readTaskId(payload) };
    } catch (error) {
      if (error instanceof MiniMaxVideoAgentError) throw error;
      throw new MiniMaxVideoAgentError(
        error instanceof Error ? error.message : 'MiniMax Video Agent request failed',
        0,
        502,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async queryTemplateTask(taskId: string): Promise<VideoAgentTaskDTO> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);

    try {
      const response = await fetch(
        `${MINIMAX_BASE_URL}${QUERY_PATH}?task_id=${encodeURIComponent(taskId)}`,
        {
          method: 'GET',
          headers: { Authorization: buildAuthHeader(this.apiKey) },
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const errorBody = await readResponseBodyOnce(response);
        throw normalizeError(parseMiniMaxError(response, errorBody));
      }

      const payload = await response.json();
      const raw = payload as Record<string, unknown> | undefined;

      const task: VideoAgentTaskDTO = {
        taskId: typeof raw?.task_id === 'string' ? raw.task_id : taskId,
        status: normalizeVideoAgentStatus(raw?.status),
      };

      const videoUrl = typeof raw?.video_url === 'string' ? raw.video_url.trim() : '';
      if (videoUrl.length > 0) task.videoUrl = videoUrl;

      return task;
    } catch (error) {
      if (error instanceof MiniMaxVideoAgentError) throw error;
      throw new MiniMaxVideoAgentError(
        error instanceof Error ? error.message : 'MiniMax Video Agent request failed',
        0,
        502,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
