import type {
  CreateVideoContextIRRequest,
  CreateVideoGenerationRequest,
  CreateVideoRegenerationRequest,
  VideoCreateTaskResponse,
  VideoListTasksResponse,
  VideoModel,
  VideoTaskActionResponse,
  VideoTaskResponse,
  VideoTaskStatus,
  VideoTaskType,
} from '@/application/dto/VideoDTO';

/**
 * Filters accepted by the shared task list endpoint.
 */
export interface VideoListTasksParams {
  pageNum: number;
  pageSize: number;
  status?: VideoTaskStatus;
  taskType?: VideoTaskType;
  model?: VideoModel;
  taskIds?: string[];
}

/**
 * Port interface for every MiniMax H3 video operation.
 *
 * Implementations are server-only and must never be bundled for the browser.
 * Task identifiers are always validated before they reach an upstream URL.
 */
export interface IMiniMaxVideoClient {
  /** `POST /v2/video_generation` — asynchronous video generation. */
  createGenerationTask(request: CreateVideoGenerationRequest): Promise<VideoCreateTaskResponse>;

  /** `POST /v2/h3_context_ir` — asynchronous prompt enrichment (no video). */
  createContextIRTask(request: CreateVideoContextIRRequest): Promise<VideoCreateTaskResponse>;

  /** `POST /v2/video_regeneration` — asynchronous 2K regeneration. */
  createRegenerationTask(request: CreateVideoRegenerationRequest): Promise<VideoCreateTaskResponse>;

  /** `GET /v2/query/video_generation/{task_id}` — task status and result. */
  queryTask(taskId: string): Promise<VideoTaskResponse>;

  /** `GET /v2/query/video_generation` — paginated task list. */
  listTasks(params: VideoListTasksParams): Promise<VideoListTasksResponse>;

  /**
   * `DELETE /v2/video_generation/{task_id}` — cancels a queued task or
   * deletes a finished task record, depending on the current upstream status.
   */
  cancelOrDeleteTask(taskId: string): Promise<VideoTaskActionResponse>;
}
