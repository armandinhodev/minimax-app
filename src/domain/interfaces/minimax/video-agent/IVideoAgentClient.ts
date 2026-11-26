/**
 * Port interface for MiniMax Video Agent (template generation) operations.
 * Implementations are server-only and must never be bundled for the browser.
 *
 * - POST /v1/video_template_generation
 * - GET  /v1/query/video_template_generation
 */
import type {
  CreateVideoAgentTaskRequest,
  VideoAgentTaskCreatedDTO,
  VideoAgentTaskDTO,
} from '@/application/dto/minimax/video-agent/VideoAgentDTO';

export interface IVideoAgentClient {
  createTemplateTask(request: CreateVideoAgentTaskRequest): Promise<VideoAgentTaskCreatedDTO>;
  queryTemplateTask(taskId: string): Promise<VideoAgentTaskDTO>;
}
