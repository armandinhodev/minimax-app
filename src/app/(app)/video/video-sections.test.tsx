import React, { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VideoContextIRSection } from './VideoContextIRSection';
import { VideoGenerationSection } from './VideoGenerationSection';
import { VideoRegenerationSection } from './VideoRegenerationSection';
import { VideoTasksSection } from './VideoTasksSection';
import {
  changeInput,
  changeSelect,
  changeTextarea,
  findButton,
  queryCalls,
} from './video-test-helpers';

const authClientMocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  parseApiError: vi.fn(async () => ({ code: 500, message: 'Request failed' })),
}));

vi.mock('@/lib/auth-client', () => authClientMocks);

vi.mock('@chakra-ui/react', () => ({
  Box: ({ children, as: Component = 'div', ...props }: { children?: ReactNode; as?: keyof JSX.IntrinsicElements } & Record<string, unknown>) => {
    void props;
    return <Component>{children}</Component>;
  },
}));

vi.mock('@/components/ui/card', () => ({
  Sheet: ({ children, accent, size, ...props }: { children?: ReactNode; accent?: string; size?: string } & Record<string, unknown>) => {
    void accent;
    void size;
    return <section {...props}>{children}</section>;
  },
  SheetHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  SheetContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, colorPalette, size, variant, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { colorPalette?: string; size?: string; variant?: string }) => {
    void colorPalette;
    void size;
    void variant;
    return <button {...props}>{children}</button>;
  },
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, options, disabled, id }: { value?: string; onValueChange?: (value: string) => void; options: Array<{ value: string; label: string }>; disabled?: boolean; id?: string }) => (
    <select value={value} disabled={disabled} id={id} onChange={(event) => onValueChange?.(event.currentTarget.value)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  ),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({ minH, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { minH?: string }) => {
    void minH;
    return <textarea {...props} />;
  },
}));

vi.mock('@/components/shared/ErrorDisplay', () => ({
  ErrorDisplay: ({ message }: { message?: string | null }) => <div>{message}</div>,
}));

describe('Video Studio sections', () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    root = null;
    container = null;
    vi.useRealTimers();
  });

  it('creates a generation task and plays the resulting video', async () => {    authClientMocks.authFetch.mockImplementation(async (url: string) => {
      if (url === '/api/minimax/video/generation') {
        return Response.json({ taskId: '424010985738629' });
      }
      if (url === '/api/minimax/video/tasks/424010985738629') {
        return Response.json({
          task: {
            id: '424010985738629',
            status: 'succeeded',
            taskType: 'generation',
            modality: 'video',
            content: { url: 'https://cdn.example.com/h3-output.mp4' },
          },
        });
      }
      return Response.json({ items: [], total: 0 });
    });

    await act(async () => {
      root!.render(<VideoGenerationSection />);
    });

    const prompt = container!.querySelector('#video-generation-prompt') as HTMLTextAreaElement;
    act(() => {
      changeTextarea(prompt, 'A boy playing basketball by the sea');
    });

    await act(async () => {
      findButton(container!, 'Generate video').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const createCall = queryCalls(authClientMocks.authFetch, '/api/minimax/video/generation')[0];
    expect(createCall).toBeDefined();
    expect(JSON.parse(String(createCall![1]?.body))).toMatchObject({
      model: 'MiniMax-H3',
      resolution: '2K',
      duration: 5,
      ratio: '16:9',
      content: [{ type: 'text', text: 'A boy playing basketball by the sea' }],
    });

    const video = container!.querySelector('video') as HTMLVideoElement | null;
    expect(video).not.toBeNull();
    expect(video!.getAttribute('src')).toBe('https://cdn.example.com/h3-output.mp4');
  });

  it('offers only concrete ratios for text-to-video and switches to adaptive for image-to-video', async () => {
    authClientMocks.authFetch.mockImplementation(async () => Response.json({ items: [], total: 0 }));

    await act(async () => {
      root!.render(<VideoGenerationSection />);
    });

    const ratio = container!.querySelector('#video-generation-ratio') as HTMLSelectElement;
    expect(Array.from(ratio.options).map((option) => option.value)).not.toContain('adaptive');

    const firstFrame = container!.querySelector('#video-generation-first-frame') as HTMLInputElement;
    act(() => {
      changeInput(firstFrame, 'https://cdn.example.com/frame.png');
    });

    await act(async () => {
      await Promise.resolve();
    });

    const updatedRatio = container!.querySelector('#video-generation-ratio') as HTMLSelectElement;
    expect(Array.from(updatedRatio.options).map((option) => option.value)).toEqual(['adaptive']);
    expect(updatedRatio.value).toBe('adaptive');
  });

  it('sends the adaptive ratio for an image-to-video request', async () => {
    authClientMocks.authFetch.mockImplementation(async (url: string) => {
      if (url === '/api/minimax/video/generation') {
        return Response.json({ taskId: '424010985738629' });
      }
      return Response.json({
        task: { id: '424010985738629', status: 'queued', taskType: 'generation', modality: 'video' },
      });
    });

    await act(async () => {
      root!.render(<VideoGenerationSection />);
    });

    const prompt = container!.querySelector('#video-generation-prompt') as HTMLTextAreaElement;
    const firstFrame = container!.querySelector('#video-generation-first-frame') as HTMLInputElement;
    act(() => {
      changeTextarea(prompt, 'Pull focus to the people in the background');
      changeInput(firstFrame, 'https://cdn.example.com/frame.png');
    });

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      findButton(container!, 'Generate video').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    const createCall = queryCalls(authClientMocks.authFetch, '/api/minimax/video/generation')[0];
    expect(JSON.parse(String(createCall![1]?.body))).toMatchObject({
      ratio: 'adaptive',
      content: [
        { type: 'text', text: 'Pull focus to the people in the background' },
        { type: 'image_url', url: 'https://cdn.example.com/frame.png', role: 'first_frame' },
      ],
    });
  });

  it('rejects an empty prompt in the browser instead of calling the API', async () => {
    authClientMocks.authFetch.mockImplementation(async () => Response.json({ items: [], total: 0 }));

    await act(async () => {
      root!.render(<VideoGenerationSection />);
    });

    await act(async () => {
      findButton(container!, 'Generate video').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(queryCalls(authClientMocks.authFetch, '/api/minimax/video/generation')).toHaveLength(0);
    expect(container!.textContent).toContain('Content must include a non-empty text prompt');
  });

  it('shows the enhanced prompt produced by a context-ir task', async () => {
    authClientMocks.authFetch.mockImplementation(async (url: string) => {
      if (url === '/api/minimax/video/context-ir') {
        return Response.json({ taskId: '426586401755526' });
      }
      if (url === '/api/minimax/video/tasks/426586401755526') {
        return Response.json({
          task: {
            id: '426586401755526',
            status: 'succeeded',
            taskType: 'h3_context_ir',
            modality: 'text',
            content: { prompt: 'integrated_multimodal_description: [Shot 1]' },
          },
        });
      }
      return Response.json({ items: [], total: 0 });
    });

    await act(async () => {
      root!.render(<VideoContextIRSection />);
    });

    const prompt = container!.querySelector('#video-context-ir-prompt') as HTMLTextAreaElement;
    act(() => {
      changeTextarea(prompt, 'A boy playing basketball by the sea');
    });

    await act(async () => {
      findButton(container!, 'Enhance prompt').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const enhanced = container!.querySelector('#video-context-ir-result') as HTMLTextAreaElement | null;
    expect(enhanced).not.toBeNull();
    expect(enhanced!.value).toContain('integrated_multimodal_description: [Shot 1]');
  });

  it('creates a regeneration task from a base video', async () => {
    authClientMocks.authFetch.mockImplementation(async (url: string) => {
      if (url === '/api/minimax/video/regeneration') {
        return Response.json({ taskId: '424010985738631' });
      }
      return Response.json({
        task: { id: '424010985738631', status: 'queued', taskType: 'regeneration', modality: 'video' },
      });
    });

    await act(async () => {
      root!.render(<VideoRegenerationSection />);
    });

    const mode = container!.querySelector('#video-regeneration-mode') as HTMLSelectElement;
    act(() => {
      changeSelect(mode, 'video');
    });

    const baseVideo = container!.querySelector('#video-regeneration-base-video') as HTMLInputElement;
    const prompt = container!.querySelector('#video-regeneration-prompt') as HTMLTextAreaElement;
    act(() => {
      changeInput(baseVideo, 'https://cdn.example.com/h3-t2va-768p.mp4');
      changeTextarea(prompt, 'The source prompt');
    });

    await act(async () => {
      findButton(container!, 'Regenerate in 2K').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const createCall = queryCalls(authClientMocks.authFetch, '/api/minimax/video/regeneration')[0];
    expect(createCall).toBeDefined();
    expect(JSON.parse(String(createCall![1]?.body))).toMatchObject({
      model: 'MiniMax-H3',
      resolution: '2K',
    });
  });

  it('reports a single guidance message when the regeneration has no source', async () => {
    authClientMocks.authFetch.mockImplementation(async () => Response.json({ items: [], total: 0 }));

    await act(async () => {
      root!.render(<VideoRegenerationSection />);
    });

    await act(async () => {
      findButton(container!, 'Regenerate in 2K').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(queryCalls(authClientMocks.authFetch, '/api/minimax/video/regeneration')).toHaveLength(0);
    expect(container!.textContent).toContain('Provide either a source task ID or a base video');
    expect(container!.textContent).not.toContain('Task ID is required');
  });

  it('stops polling once the section unmounts', async () => {
    vi.useFakeTimers();
    authClientMocks.authFetch.mockImplementation(async (url: string) => {
      if (url === '/api/minimax/video/generation') {
        return Response.json({ taskId: '424010985738629' });
      }
      return Response.json({
        task: { id: '424010985738629', status: 'queued', taskType: 'generation', modality: 'video' },
      });
    });

    await act(async () => {
      root!.render(<VideoGenerationSection />);
    });

    const prompt = container!.querySelector('#video-generation-prompt') as HTMLTextAreaElement;
    act(() => {
      changeTextarea(prompt, 'A boy playing basketball by the sea');
    });

    await act(async () => {
      findButton(container!, 'Generate video').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const pollsBeforeUnmount = queryCalls(
      authClientMocks.authFetch,
      '/api/minimax/video/tasks/424010985738629',
    ).length;
    expect(pollsBeforeUnmount).toBe(1);

    act(() => {
      root?.unmount();
      root = null;
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(
      queryCalls(authClientMocks.authFetch, '/api/minimax/video/tasks/424010985738629'),
    ).toHaveLength(pollsBeforeUnmount);
  });

  it('never starts a second create while one is still running', async () => {
    let releaseCreate: (() => void) | null = null;
    authClientMocks.authFetch.mockImplementation(async (url: string) => {
      if (url === '/api/minimax/video/generation') {
        await new Promise<void>((resolve) => { releaseCreate = resolve; });
        return Response.json({ taskId: '424010985738629' });
      }
      return Response.json({
        task: { id: '424010985738629', status: 'queued', taskType: 'generation', modality: 'video' },
      });
    });

    await act(async () => {
      root!.render(<VideoGenerationSection />);
    });

    const prompt = container!.querySelector('#video-generation-prompt') as HTMLTextAreaElement;
    act(() => {
      changeTextarea(prompt, 'A boy playing basketball by the sea');
    });

    const button = findButton(container!, 'Generate video');
    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(button.disabled).toBe(true);

    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(queryCalls(authClientMocks.authFetch, '/api/minimax/video/generation')).toHaveLength(1);

    await act(async () => {
      releaseCreate?.();
      await Promise.resolve();
    });
  });

  it('offers prompt expansion only for MiniMax-H3-Max', async () => {
    await act(async () => {
      root!.render(<VideoGenerationSection />);
    });

    expect(container!.querySelector('#video-generation-prompt-expansion')).toBeNull();

    const model = container!.querySelector('#video-generation-model') as HTMLSelectElement;
    await act(async () => {
      changeSelect(model, 'MiniMax-H3-Max');
    });

    const expansion = container!.querySelector('#video-generation-prompt-expansion') as HTMLSelectElement | null;
    expect(expansion).not.toBeNull();
    expect(Array.from(expansion!.options).map((option) => option.value)).toEqual([
      'disabled',
      'balanced',
      'quality',
    ]);
  });

  it('re-scrolls the error banner when the same validation error repeats', async () => {
    const scrollSpy = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollSpy as unknown as typeof Element.prototype.scrollIntoView;

    try {
      await act(async () => {
        root!.render(<VideoGenerationSection />);
      });

      const button = findButton(container!, 'Generate video');
      await act(async () => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await act(async () => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(scrollSpy).toHaveBeenCalledTimes(2);
    } finally {
      if (original) {
        Element.prototype.scrollIntoView = original;
      } else {
        delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
      }
    }
  });

  it('lists the tasks and distinguishes an empty result from a missing load', async () => {    authClientMocks.authFetch.mockImplementation(async () => Response.json({ items: [], total: 0 }));

    await act(async () => {
      root!.render(<VideoTasksSection />);
    });

    expect(container!.textContent).toContain('No task loaded yet.');

    await act(async () => {
      findButton(container!, 'Refresh tasks').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(queryCalls(authClientMocks.authFetch, '/api/minimax/video/tasks')).toHaveLength(1);
    expect(container!.textContent).toContain('No task matches the current filters.');
  });
});
