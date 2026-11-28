import React, { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScreenStore } from '@/components/shared/screen-store';
import ImageToImagePage from './page';

const authClientMocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  parseApiError: vi.fn(),
}));

vi.mock('@/lib/auth-client', () => authClientMocks);

vi.mock('@chakra-ui/react', () => ({
  Box: ({ children, as: Component = 'div', role, 'aria-label': ariaLabel, gridTemplateColumns, position }: {
    children?: ReactNode;
    as?: keyof JSX.IntrinsicElements;
    role?: string;
    'aria-label'?: string;
    gridTemplateColumns?: unknown;
    position?: React.CSSProperties['position'];
  }) => {
    return <Component role={role} aria-label={ariaLabel} style={{ gridTemplateColumns: typeof gridTemplateColumns === 'string' ? gridTemplateColumns : undefined, position }}>{children}</Component>;
  },
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, colorPalette, size, variant, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { colorPalette?: string; size?: string; variant?: string }) => {
    void colorPalette;
    void size;
    void variant;
    return <button {...props}>{children}</button>;
  },
}));

vi.mock('@/components/ui/card', () => ({
  Sheet: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
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

function changeTextarea(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function changeInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function clickButton(container: HTMLElement, id: string) {
  const button = container.querySelector(`#${id}`) as HTMLButtonElement | null;
  button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('ImageToImagePage', () => {
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
  });

  it('keeps Reset disabled while a request is in flight', () => {
    useScreenStore.getState().setValue('image-edit:isLoading', true);

    act(() => {
      root!.render(<ImageToImagePage />);
    });

    const reset = Array.from(container!.querySelectorAll('button')).find(
      (button) => button.textContent === 'Reset',
    ) as HTMLButtonElement | undefined;

    expect(reset?.disabled).toBe(true);
  });

  it('blocks generation until at least one reference image is selected', async () => {
    act(() => {
      root!.render(<ImageToImagePage />);
    });

    const prompt = container!.querySelector('#image-edit-prompt') as HTMLTextAreaElement;
    act(() => {
      changeTextarea(prompt, 'Keep the same person in a studio portrait.');
    });

    const generateButton = Array.from(container!.querySelectorAll('button')).find((button) => button.textContent === 'Generate images');
    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(authClientMocks.authFetch).not.toHaveBeenCalled();
  });

  it('sends reference images and the MiniMax-H3-Image edit contract', async () => {
    authClientMocks.authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'req-edit',
        imageUrls: ['https://example.com/edit-0.jpg'],
        images: [{
          index: 0,
          url: 'https://example.com/edit-0.jpg',
          size: '5440x3072',
          revisedPrompt: 'An enhanced edit prompt.',
          error: null,
        }],
        metadata: {
          successCount: 1,
          failedCount: 0,
          totalCount: 1,
          outputFormat: 'jpeg',
          requestId: 'req-edit',
          created: 1792308678,
          usage: null,
        },
        expiresAt: null,
      }),
    });

    act(() => {
      root!.render(<ImageToImagePage />);
    });

    const input = container!.querySelector('#reference-images') as HTMLInputElement;
    expect(container!.querySelector('[style*="position: sticky"]')?.textContent).toContain('No result yet');
    const prompt = container!.querySelector('#image-edit-prompt') as HTMLTextAreaElement;
    const count = container!.querySelector('#image-edit-count') as HTMLInputElement;

    act(() => {
      changeInput(input, 'https://cdn.example.com/cat.png, https://cdn.example.com/dog.png');
    });

    act(() => {
      changeTextarea(prompt, 'Replace the cat with the dog and keep the background.');
      changeInput(count, '2');
      clickButton(container!, 'image-edit-ratio-3-4');
    });

    const generateButton = Array.from(container!.querySelectorAll('button')).find((button) => button.textContent === 'Generate images');
    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(authClientMocks.authFetch).toHaveBeenCalledWith('/api/minimax/image', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Replace the cat with the dog and keep the background.',
        model: 'MiniMax-H3-Image',
        n: 2,
        outputFormat: 'jpeg',
        responseFormat: 'url',
        outputCompression: 95,
        aspectRatio: '3:4',
        area: '4K',
        images: [
          { imageUrl: 'https://cdn.example.com/cat.png' },
          { imageUrl: 'https://cdn.example.com/dog.png' },
        ],
      }),
    }));
    const image = container!.querySelector<HTMLImageElement>('img[alt="Generated image 1"]');
    expect(image?.parentElement?.parentElement?.style.gridTemplateColumns).toBe('minmax(0, 1fr)');
    expect(image?.style.width).toBe('100%');
    expect(image?.style.height).toBe('auto');
    expect(image?.style.aspectRatio).toBe('');
    expect(image?.style.objectFit).toBe('');
    expect(image?.closest('[style*="position: static"]')).toBeTruthy();
  });

  it('uploads the reference and never offers the MiniMax library picker', async () => {
    authClientMocks.authFetch.mockImplementation(async (url: string, options?: RequestInit) => {
      if (url === '/api/minimax/files' && options?.method === 'POST') {
        return Response.json({ fileId: '88' });
      }

      return Response.json({
        id: 'req-upload',
        imageUrls: ['https://example.com/edit-upload.jpg'],
        images: [{ index: 0, url: 'https://example.com/edit-upload.jpg', size: '1024x1024', revisedPrompt: null, error: null }],
        metadata: { successCount: 1, failedCount: 0, totalCount: 1, outputFormat: 'jpeg', requestId: 'req-upload', created: 1, usage: null },
        expiresAt: null,
      });
    });

    await act(async () => {
      root!.render(<ImageToImagePage />);
    });

    const group = container!.querySelector('[aria-label="Choose how to add the reference image"]') as HTMLElement;
    const methods = Array.from(group.querySelectorAll('button')).map((button) => button.textContent);
    expect(methods).toEqual(['URL', 'Paste image', 'Upload']);
    expect(container!.textContent).not.toContain('From MiniMax');

    act(() => {
      Array.from(group.querySelectorAll('button')).find((button) => button.textContent === 'Upload')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const fileInput = container!.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [new File(['x'], 'studio.png', { type: 'image/png' })] });
    await act(async () => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    expect(container!.textContent).toContain('studio.png');

    const prompt = container!.querySelector('#image-edit-prompt') as HTMLTextAreaElement;
    act(() => {
      changeTextarea(prompt, 'Restyle it as a studio portrait.');
    });

    const generateButton = Array.from(container!.querySelectorAll('button')).find((button) => button.textContent === 'Generate images');
    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const call = authClientMocks.authFetch.mock.calls.find(([url]) => url === '/api/minimax/image');
    const body = JSON.parse((call![1] as RequestInit).body as string);
    expect(body.images).toEqual([{ imageUrl: 'mm_file://88' }]);
  });

  it('rejects more than 16 reference images', async () => {
    act(() => {
      root!.render(<ImageToImagePage />);
    });

    const input = container!.querySelector('#reference-images') as HTMLInputElement;
    act(() => {
      changeInput(input, Array.from({ length: 17 }, (_value, index) => `https://cdn.example.com/ref-${index}.png`).join(', '));
    });

    const prompt = container!.querySelector('#image-edit-prompt') as HTMLTextAreaElement;
    act(() => {
      changeTextarea(prompt, 'Keep the same person in a studio portrait.');
    });

    const generateButton = Array.from(container!.querySelectorAll('button')).find((button) => button.textContent === 'Generate images');
    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(authClientMocks.authFetch).not.toHaveBeenCalled();
    expect(container!.textContent).toContain('16');
  });

  it('reports per-item failures returned by the provider', async () => {
    authClientMocks.authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'req-edit',
        imageUrls: [],
        images: [{
          index: 0,
          url: null,
          size: null,
          revisedPrompt: null,
          error: { code: '1027', message: 'output image failed content safety check' },
        }],
        metadata: {
          successCount: 0,
          failedCount: 1,
          totalCount: 1,
          outputFormat: 'jpeg',
          requestId: 'req-edit',
          created: 1792308678,
          usage: null,
        },
        expiresAt: null,
      }),
    });

    act(() => {
      root!.render(<ImageToImagePage />);
    });

    const input = container!.querySelector('#reference-images') as HTMLInputElement;
    const prompt = container!.querySelector('#image-edit-prompt') as HTMLTextAreaElement;

    act(() => {
      changeInput(input, 'https://cdn.example.com/cat.png');
    });

    act(() => {
      changeTextarea(prompt, 'Replace the cat with the dog.');
    });

    const generateButton = Array.from(container!.querySelectorAll('button')).find((button) => button.textContent === 'Generate images');
    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container!.textContent).toContain('output image failed content safety check');
  });
});
