import React, { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AsrPage from './page';

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

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, colorPalette, size, variant, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { colorPalette?: string; size?: string; variant?: string }) => {
    void colorPalette;
    void size;
    void variant;
    return <button {...props}>{children}</button>;
  },
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, accent, size, ...props }: { children?: ReactNode; accent?: string; size?: string } & Record<string, unknown>) => {
    void accent;
    void size;
    return <section {...props}>{children}</section>;
  },
  CardHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
  CardDescription: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  CardContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
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
  ErrorDisplay: ({ message }: { message?: string | null }) => <div role="alert">{message}</div>,
}));

function changeSelect(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === label);
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

/** Builds a File and puts it in the input, the way the browser would. */
function selectFile(container: HTMLElement, name: string, type: string, size: number) {
  const input = container.querySelector('#asr-file') as HTMLInputElement;
  const file = new File([new Uint8Array(size)], name, { type });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('AsrPage', () => {
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

  it('keeps the transcribe actions disabled until a valid file is chosen', async () => {
    await act(async () => {
      root!.render(<AsrPage />);
    });

    expect(findButton(container!, 'Transcribe').disabled).toBe(true);
    expect(findButton(container!, 'Stream transcript').disabled).toBe(true);

    act(() => {
      selectFile(container!, 'meeting.wav', 'audio/wav', 128);
    });

    expect(findButton(container!, 'Transcribe').disabled).toBe(false);
    expect(findButton(container!, 'Stream transcript').disabled).toBe(false);
  });

  it('rejects an unsupported file without uploading it', async () => {
    await act(async () => {
      root!.render(<AsrPage />);
    });

    act(() => {
      selectFile(container!, 'notes.txt', 'text/plain', 64);
    });

    expect(findButton(container!, 'Transcribe').disabled).toBe(true);
    expect(container!.querySelector('[role="alert"]')?.textContent).toContain('Unsupported audio format');
    expect(authClientMocks.authFetch).not.toHaveBeenCalled();
  });

  it('rejects a file over the 50MB ceiling without uploading it', async () => {
    await act(async () => {
      root!.render(<AsrPage />);
    });

    act(() => {
      selectFile(container!, 'long.wav', 'audio/wav', 50 * 1024 * 1024 + 1);
    });

    expect(findButton(container!, 'Transcribe').disabled).toBe(true);
    expect(container!.querySelector('[role="alert"]')?.textContent).toContain('50MB');
    expect(authClientMocks.authFetch).not.toHaveBeenCalled();
  });

  it('shows the timestamp granularity only for the formats with diarization', async () => {
    await act(async () => {
      root!.render(<AsrPage />);
    });

    expect(container!.querySelector('#asr-timestamp-level')).toBeNull();

    const format = container!.querySelector('#asr-format') as HTMLSelectElement;
    act(() => {
      changeSelect(format, 'verbose_json');
    });
    expect(container!.querySelector('#asr-timestamp-level')).not.toBeNull();

    act(() => {
      changeSelect(format, 'srt');
    });
    expect(container!.querySelector('#asr-timestamp-level')).not.toBeNull();

    act(() => {
      changeSelect(format, 'json');
    });
    expect(container!.querySelector('#asr-timestamp-level')).toBeNull();
  });

  it('shows a visible default for the language and the timestamp selects', async () => {
    await act(async () => {
      root!.render(<AsrPage />);
    });

    const language = container!.querySelector('#asr-language') as HTMLSelectElement;
    expect(language.value).toBe('auto');
    expect(language.selectedOptions[0]?.textContent).toContain('Auto');

    const format = container!.querySelector('#asr-format') as HTMLSelectElement;
    act(() => {
      changeSelect(format, 'verbose_json');
    });

    const timestamp = container!.querySelector('#asr-timestamp-level') as HTMLSelectElement;
    expect(timestamp.value).toBe('default');
    expect(timestamp.selectedOptions[0]?.textContent).toContain('Default');
  });

  it('sends the empty language and timestamp as empty strings upstream', async () => {
    authClientMocks.authFetch.mockResolvedValue(Response.json({ text: 'hola', duration: 1 }));

    await act(async () => {
      root!.render(<AsrPage />);
    });

    act(() => {
      selectFile(container!, 'meeting.wav', 'audio/wav', 128);
    });

    await act(async () => {
      findButton(container!, 'Transcribe').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    const body = authClientMocks.authFetch.mock.calls[0][1]?.body as FormData;
    expect(body.get('language')).toBe('');
    expect(body.get('timestamp_level')).toBe('');
  });
});
