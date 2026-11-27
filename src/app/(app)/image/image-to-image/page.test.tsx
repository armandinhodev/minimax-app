import React, { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ImageToImagePage from './page';

const authClientMocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  parseApiError: vi.fn(),
}));

vi.mock('@/lib/auth-client', () => authClientMocks);

vi.mock('@chakra-ui/react', () => ({
  Box: ({ children, as: Component = 'div', ...props }: { children?: ReactNode; as?: keyof JSX.IntrinsicElements } & Record<string, unknown>) => {
    void props;
    return <Component>{children}</Component>;
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

function selectFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('ImageToImagePage', () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;
  const originalFileReader = globalThis.FileReader;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();

    class MockFileReader {
      result: string | null = null;
      onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL(file: File) {
        this.result = `data:${file.type};base64,${Buffer.from(file.name).toString('base64')}`;
        this.onload?.(new ProgressEvent('load') as ProgressEvent<FileReader>);
      }
    }
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    globalThis.FileReader = originalFileReader;
    container?.remove();
    root = null;
    container = null;
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
    const prompt = container!.querySelector('#image-edit-prompt') as HTMLTextAreaElement;
    const count = container!.querySelector('#image-edit-count') as HTMLInputElement;

    await act(async () => {
      selectFiles(input, [
        new File(['cat'], 'cat.png', { type: 'image/png' }),
        new File(['dog'], 'dog.jpg', { type: 'image/jpeg' }),
      ]);
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
          { imageUrl: `data:image/png;base64,${Buffer.from('cat.png').toString('base64')}` },
          { imageUrl: `data:image/jpeg;base64,${Buffer.from('dog.jpg').toString('base64')}` },
        ],
      }),
    }));
  });

  it('rejects more than 16 reference images', async () => {
    act(() => {
      root!.render(<ImageToImagePage />);
    });

    const input = container!.querySelector('#reference-images') as HTMLInputElement;
    await act(async () => {
      selectFiles(input, Array.from({ length: 17 }, (_value, index) => new File(['x'], `ref-${index}.png`, { type: 'image/png' })));
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

    await act(async () => {
      selectFiles(input, [new File(['cat'], 'cat.png', { type: 'image/png' })]);
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
