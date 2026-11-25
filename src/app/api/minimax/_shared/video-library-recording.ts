import type { CreateLibraryAssetDTO, LibraryGenerationSource } from '@/application/dto/library/LibraryDTO';
import type { VideoTaskDTO } from '@/application/dto/minimax/video/VideoDTO';
import { SQLiteGenerationRepository } from '@/infrastructure/sqlite/SQLiteGenerationRepository';

function safeOutputUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? value : undefined;
  } catch { return undefined; }
}

// Recording must never turn a successfully submitted billable task into an API error.
export function recordVideoTaskBestEffort(task: VideoTaskDTO, prompt?: string): void {
  try {
    const source: LibraryGenerationSource = task.taskType === 'h3_context_ir'
      ? 'video-context-ir' : task.taskType === 'regeneration' ? 'video-regeneration' : 'video-generation';
    const url = safeOutputUrl(task.content?.url);
    const assets: CreateLibraryAssetDTO[] = task.status === 'succeeded' && url ? [{
      kind: 'video', storageType: 'provider_url', storageRef: url, format: 'mp4', mimeType: 'video/mp4',
      metadata: { temporaryUrl: true, expirationUnknown: true },
    }] : [];
    const metadata: Record<string, unknown> = {
      providerStatus: task.status, taskType: task.taskType,
      ...(task.updatedAt !== undefined ? { providerUpdatedAt: task.updatedAt } : {}),
      ...(task.resolution ? { resolution: task.resolution } : {}),
      ...(task.duration !== undefined ? { durationSeconds: task.duration } : {}),
      ...(task.ratio ? { aspectRatio: task.ratio } : {}),
      ...(task.content?.prompt ? { enhancedPrompt: task.content.prompt } : {}),
      ...(task.error?.message ? { providerError: task.error.message } : {}),
    };
    new SQLiteGenerationRepository().upsertTaskGeneration({
      kind: 'video', source, providerTaskId: task.id, prompt, model: task.model,
      status: task.status === 'succeeded' ? 'completed'
        : task.status === 'failed' || task.status === 'cancelled' ? 'failed' : 'processing',
      metadata, assets,
    });
  } catch {
    console.error('Failed to persist video task metadata.');
  }
}
