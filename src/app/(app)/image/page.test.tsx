import React, { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ImagePage from './page';

const authClientMocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  parseApiError: vi.fn(),
}));

const historyMocks = vi.hoisted(() => ({
  saveHistoryItem: vi.fn(),
}));

vi.mock('@/lib/auth-client', () => authClientMocks);
vi.mock('@/lib/history', () => historyMocks);

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

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, disabled, onChange, id }: { checked?: boolean; disabled?: boolean; id?: string; onChange?: (checked: boolean) => void }) => (
    <input
      id={id}
      aria-label="Disable Prompt Enhancement"
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange?.(event.currentTarget.checked)}
    />
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

describe('ImagePage', () => {
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

  it('generates images with the MiniMax-H3-Image contract and relies on Library recording', async () => {
    authClientMocks.authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'req-1',
        imageUrls: ['https://example.com/image-1.jpg'],
        images: [{
          index: 0,
          url: 'https://example.com/image-1.jpg',
          size: '2720x1536',
          revisedPrompt: 'An enhanced prompt.',
          error: null,
        }],
        metadata: {
          successCount: 1,
          failedCount: 0,
          totalCount: 1,
          outputFormat: 'jpeg',
          requestId: 'req-1',
          created: 1792308678,
          usage: null,
        },
        expiresAt: null,
      }),
    });

    act(() => {
      root!.render(<ImagePage />);
    });

    const prompt = container!.querySelector('#image-prompt') as HTMLTextAreaElement;
    const count = container!.querySelector('#image-count') as HTMLInputElement;

    act(() => {
      changeTextarea(prompt, 'A premium studio product photo.');
      changeInput(count, '2');
      clickButton(container!, 'image-ratio-16-9');
      clickButton(container!, 'image-area-2k');
    });

    const generateButton = Array.from(container!.querySelectorAll('button')).find((button) => button.textContent === 'Generate images');
    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(authClientMocks.authFetch).toHaveBeenCalledWith('/api/minimax/image', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'A premium studio product photo.',
        model: 'MiniMax-H3-Image',
        n: 2,
        outputFormat: 'jpeg',
        responseFormat: 'url',
        outputCompression: 95,
        disablePromptEnhanced: false,
        aspectRatio: '16:9',
        area: '2K',
      }),
    }));
    expect(historyMocks.saveHistoryItem).not.toHaveBeenCalled();
    expect(container!.textContent).toContain('Images generated and saved to Library');
  });

  it('never sends the legacy image-01 seed option', async () => {
    authClientMocks.authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'req-1',
        imageUrls: [],
        images: [],
        metadata: { successCount: 0, failedCount: 0, totalCount: 0, outputFormat: 'jpeg', requestId: null, created: null, usage: null },
        expiresAt: null,
      }),
    });

    act(() => {
      root!.render(<ImagePage />);
    });

    const prompt = container!.querySelector('#image-prompt') as HTMLTextAreaElement;
    act(() => {
      changeTextarea(prompt, 'A premium studio product photo.');
    });

    const generateButton = Array.from(container!.querySelectorAll('button')).find((button) => button.textContent === 'Generate images');
    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const body = JSON.parse(String(authClientMocks.authFetch.mock.calls[0]?.[1]?.body));
    expect(body).not.toHaveProperty('seed');
    expect(body).not.toHaveProperty('promptOptimizer');
    expect(container!.querySelector('#image-seed')).toBeNull();
  });

  it('sends an explicit width x height size instead of the aspect ratio and area', async () => {
    authClientMocks.authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'req-1',
        imageUrls: [],
        images: [],
        metadata: { successCount: 0, failedCount: 0, totalCount: 0, outputFormat: 'jpeg', requestId: null, created: null, usage: null },
        expiresAt: null,
      }),
    });

    act(() => {
      root!.render(<ImagePage />);
    });

    const prompt = container!.querySelector('#image-prompt') as HTMLTextAreaElement;
    const size = container!.querySelector('#image-size') as HTMLInputElement;

    act(() => {
      changeTextarea(prompt, 'A premium studio product photo.');
      changeInput(size, '2720x1536');
    });

    const generateButton = Array.from(container!.querySelectorAll('button')).find((button) => button.textContent === 'Generate images');
    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const body = JSON.parse(String(authClientMocks.authFetch.mock.calls[0]?.[1]?.body));
    expect(body.size).toBe('2720x1536');
    expect(body).not.toHaveProperty('aspectRatio');
    expect(body).not.toHaveProperty('area');
  });

  it('blocks disabling prompt enhancement without a fixed ratio or size', async () => {
    act(() => {
      root!.render(<ImagePage />);
    });

    const prompt = container!.querySelector('#image-prompt') as HTMLTextAreaElement;
    const optimizer = container!.querySelector('input[type="checkbox"]') as HTMLInputElement;

    act(() => {
      changeTextarea(prompt, 'A premium studio product photo.');
      optimizer.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const generateButton = Array.from(container!.querySelectorAll('button')).find((button) => button.textContent === 'Generate images');
    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(authClientMocks.authFetch).not.toHaveBeenCalled();
    expect(container!.textContent).toContain('Disable prompt enhancement');
  });

  it('reports per-item failures returned by the provider', async () => {
    authClientMocks.authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'req-1',
        imageUrls: ['https://example.com/image-1.jpg'],
        images: [
          {
            index: 0,
            url: 'https://example.com/image-1.jpg',
            size: '2720x1536',
            revisedPrompt: 'An enhanced prompt.',
            error: null,
          },
          {
            index: 1,
            url: null,
            size: null,
            revisedPrompt: null,
            error: { code: '1027', message: 'output image failed content safety check' },
          },
        ],
        metadata: {
          successCount: 1,
          failedCount: 1,
          totalCount: 2,
          outputFormat: 'jpeg',
          requestId: 'req-1',
          created: 1792308678,
          usage: null,
        },
        expiresAt: null,
      }),
    });

    act(() => {
      root!.render(<ImagePage />);
    });

    const prompt = container!.querySelector('#image-prompt') as HTMLTextAreaElement;
    act(() => {
      changeTextarea(prompt, 'A premium studio product photo.');
    });

    const generateButton = Array.from(container!.querySelectorAll('button')).find((button) => button.textContent === 'Generate images');
    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container!.textContent).toContain('output image failed content safety check');
    expect(container!.querySelector('img')?.getAttribute('src')).toBe('https://example.com/image-1.jpg');
  });

  it('blocks empty prompts before calling the API', async () => {
    act(() => {
      root!.render(<ImagePage />);
    });

    const generateButton = Array.from(container!.querySelectorAll('button')).find((button) => button.textContent === 'Generate images');
    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(authClientMocks.authFetch).not.toHaveBeenCalled();
  });

  it('keeps generated previews visible without browser history storage', async () => {
    authClientMocks.authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'generation-2',
        imageUrls: ['https://example.com/image-2.jpg'],
        images: [{
          index: 0,
          url: 'https://example.com/image-2.jpg',
          size: '1024x1024',
          revisedPrompt: null,
          error: null,
        }],
        metadata: {
          successCount: 1,
          failedCount: 0,
          totalCount: 1,
          outputFormat: 'jpeg',
          requestId: 'generation-2',
          created: null,
          usage: null,
        },
        expiresAt: null,
      }),
    });

    act(() => {
      root!.render(<ImagePage />);
    });

    const prompt = container!.querySelector('#image-prompt') as HTMLTextAreaElement;
    const generateButton = Array.from(container!.querySelectorAll('button')).find((button) => button.textContent === 'Generate images');

    act(() => {
      changeTextarea(prompt, 'A cinematic product banner.');
    });

    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container!.querySelector('img')?.getAttribute('src')).toBe('https://example.com/image-2.jpg');
    expect(historyMocks.saveHistoryItem).not.toHaveBeenCalled();
    expect(container!.textContent).toContain('Images generated and saved to Library');
    expect(container!.textContent).not.toContain('Failed to generate images');
  });
});
