import { describe, expect, it, vi } from 'vitest';

import type { IMiniMaxVideoClient } from '@/domain/interfaces/IMiniMaxVideoClient';

import { CancelVideoTaskUseCase } from './CancelVideoTask';
import { ListVideoTasksUseCase } from './ListVideoTasks';
import { QueryVideoTaskUseCase } from './QueryVideoTask';
import { VideoValidationError } from './VideoValidationError';

function createClient() {
  return {
    createGenerationTask: vi.fn(),
    createContextIRTask: vi.fn(),
    createRegenerationTask: vi.fn(),
    queryTask: vi.fn(),
    listTasks: vi.fn(),
    cancelOrDeleteTask: vi.fn(),
  } satisfies IMiniMaxVideoClient;
}

describe('QueryVideoTaskUseCase', () => {
  it('queries a validated task id', async () => {
    const client = createClient();
    client.queryTask.mockResolvedValue({
      task: { id: '424010985738629', status: 'succeeded', taskType: 'generation' },
    });

    const result = await new QueryVideoTaskUseCase(client).execute('424010985738629');

    expect(result.task.status).toBe('succeeded');
    expect(client.queryTask).toHaveBeenCalledWith('424010985738629');
  });

  it('rejects an unsafe task id before calling the client', async () => {
    const client = createClient();

    await expect(new QueryVideoTaskUseCase(client).execute('../etc/passwd')).rejects.toBeInstanceOf(
      VideoValidationError,
    );

    expect(client.queryTask).not.toHaveBeenCalled();
  });
});

describe('ListVideoTasksUseCase', () => {
  it('applies pagination defaults and forwards the filters', async () => {
    const client = createClient();
    client.listTasks.mockResolvedValue({ items: [], total: 0 });

    await new ListVideoTasksUseCase(client).execute({ status: 'queued' });

    expect(client.listTasks).toHaveBeenCalledWith({
      pageNum: 1,
      pageSize: 20,
      status: 'queued',
      taskType: undefined,
      model: undefined,
      taskIds: undefined,
    });
  });

  it('rejects an invalid task id filter', async () => {
    const client = createClient();

    await expect(
      new ListVideoTasksUseCase(client).execute({ taskIds: ['not a valid id'] }),
    ).rejects.toBeInstanceOf(VideoValidationError);

    expect(client.listTasks).not.toHaveBeenCalled();
  });
});

describe('CancelVideoTaskUseCase', () => {
  it('cancels or deletes a validated task', async () => {
    const client = createClient();
    client.cancelOrDeleteTask.mockResolvedValue({
      taskId: '424010985738629',
      action: 'cancelled',
      status: 'cancelled',
    });

    const result = await new CancelVideoTaskUseCase(client).execute({
      taskId: '424010985738629',
      taskType: 'generation',
    });

    expect(result.action).toBe('cancelled');
    expect(client.cancelOrDeleteTask).toHaveBeenCalledWith('424010985738629');
  });

  it('rejects an unknown task type', async () => {
    const client = createClient();

    await expect(
      new CancelVideoTaskUseCase(client).execute({
        taskId: '424010985738629',
        taskType: 'nope' as never,
      }),
    ).rejects.toBeInstanceOf(VideoValidationError);

    expect(client.cancelOrDeleteTask).not.toHaveBeenCalled();
  });
});
