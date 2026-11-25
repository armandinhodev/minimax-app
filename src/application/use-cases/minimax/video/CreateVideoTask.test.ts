import { describe, expect, it, vi } from 'vitest';

import type { IVideoClient } from '@/domain/interfaces/minimax/video/IVideoClient';

import { CreateVideoContextIRUseCase } from './CreateVideoContextIR';
import { CreateVideoGenerationUseCase } from './CreateVideoGeneration';
import { CreateVideoRegenerationUseCase } from './CreateVideoRegeneration';
import { VideoValidationError } from './VideoValidationError';

function createClient() {
  return {
    createGenerationTask: vi.fn(),
    createContextIRTask: vi.fn(),
    createRegenerationTask: vi.fn(),
    queryTask: vi.fn(),
    listTasks: vi.fn(),
    cancelOrDeleteTask: vi.fn(),
  } satisfies IVideoClient;
}

describe('CreateVideoGenerationUseCase', () => {
  it('forwards a valid generation request to the client', async () => {
    const client = createClient();
    client.createGenerationTask.mockResolvedValue({ taskId: 'task-1' });

    const result = await new CreateVideoGenerationUseCase(client).execute({
      model: 'MiniMax-H3',
      content: [{ type: 'text', text: 'A boy playing basketball by the sea' }],
      resolution: '2K',
      duration: 5,
      ratio: '16:9',
    });

    expect(result).toEqual({ taskId: 'task-1' });
    expect(client.createGenerationTask).toHaveBeenCalledWith(expect.objectContaining({
      model: 'MiniMax-H3',
      resolution: '2K',
      duration: 5,
      ratio: '16:9',
    }));
  });

  it('rejects a request that breaks the per-model rules before calling the client', async () => {
    const client = createClient();

    await expect(new CreateVideoGenerationUseCase(client).execute({
      model: 'MiniMax-H3-Highspeed',
      content: [{ type: 'text', text: 'A boy playing basketball by the sea' }],
      resolution: '2K',
      duration: 5,
      ratio: '16:9',
    })).rejects.toBeInstanceOf(VideoValidationError);

    expect(client.createGenerationTask).not.toHaveBeenCalled();
  });
});

describe('CreateVideoContextIRUseCase', () => {
  it('forwards a valid context-ir request to the client', async () => {
    const client = createClient();
    client.createContextIRTask.mockResolvedValue({ taskId: 'task-ir' });

    const result = await new CreateVideoContextIRUseCase(client).execute({
      model: 'MiniMax-H3',
      content: [{ type: 'text', text: 'A boy playing basketball by the sea' }],
      duration: 5,
      ratio: '16:9',
    });

    expect(result).toEqual({ taskId: 'task-ir' });
    expect(client.createContextIRTask).toHaveBeenCalledTimes(1);
  });

  it('rejects models that do not support context-ir', async () => {
    const client = createClient();

    await expect(new CreateVideoContextIRUseCase(client).execute({
      model: 'MiniMax-H3-Lite',
      content: [{ type: 'text', text: 'A boy playing basketball by the sea' }],
      duration: 5,
      ratio: '16:9',
    })).rejects.toBeInstanceOf(VideoValidationError);

    expect(client.createContextIRTask).not.toHaveBeenCalled();
  });
});

describe('CreateVideoRegenerationUseCase', () => {
  it('forwards a base-video regeneration request to the client', async () => {
    const client = createClient();
    client.createRegenerationTask.mockResolvedValue({ taskId: 'task-regen' });

    const result = await new CreateVideoRegenerationUseCase(client).execute({
      model: 'MiniMax-H3',
      content: [
        { type: 'text', text: 'Epic space-opera theatrical teaser' },
        { type: 'video_url', url: 'https://cdn.example.com/h3-t2va-768p.mp4', role: 'base_video' },
      ],
      resolution: '2K',
    });

    expect(result).toEqual({ taskId: 'task-regen' });
    expect(client.createRegenerationTask).toHaveBeenCalledTimes(1);
  });

  it('rejects a request that mixes a source task with a base video', async () => {
    const client = createClient();

    await expect(new CreateVideoRegenerationUseCase(client).execute({
      model: 'MiniMax-H3',
      sourceTaskId: '424010985738629',
      content: [
        { type: 'video_url', url: 'https://cdn.example.com/h3-t2va-768p.mp4', role: 'base_video' },
      ],
      resolution: '2K',
    })).rejects.toBeInstanceOf(VideoValidationError);

    expect(client.createRegenerationTask).not.toHaveBeenCalled();
  });
});
