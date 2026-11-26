import React, { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import VideoAgentPage from './page';

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

const TEMPLATES = [
  {
    id: '392747428568649728',
    name: 'Diving',
    description: 'The subject completes a dive.',
    requiresMedia: true,
    requiresText: false,
  },
  {
    id: '394514820878671878',
    name: 'Anime Life Sim',
    description: 'An anime gameplay video.',
    requiresMedia: false,
    requiresText: true,
  },
];

function changeSelect(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function changeInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === label);
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

describe('VideoAgentPage', () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    authClientMocks.authFetch.mockImplementation(async (url: string) => {
      if (url === '/api/minimax/video-agent/templates') {
        return Response.json({ templates: TEMPLATES });
      }
      return Response.json({ taskId: '401047179385389059' });
    });
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

  it('asks for the media a template needs and hides what it does not', async () => {
    await act(async () => {
      root!.render(<VideoAgentPage />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container!.querySelector('#video-agent-media')).not.toBeNull();
    expect(container!.querySelector('#video-agent-text')).toBeNull();

    const select = container!.querySelector('#video-agent-template') as HTMLSelectElement;
    act(() => {
      changeSelect(select, '394514820878671878');
    });

    expect(container!.querySelector('#video-agent-media')).toBeNull();
    expect(container!.querySelector('#video-agent-text')).not.toBeNull();
  });

  it('keeps the primary action disabled until the required field is filled', async () => {
    await act(async () => {
      root!.render(<VideoAgentPage />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(findButton(container!, 'Create video').disabled).toBe(true);

    const media = container!.querySelector('#video-agent-media') as HTMLInputElement;
    act(() => {
      changeInput(media, 'https://example.com/photo.jpg');
    });

    expect(findButton(container!, 'Create video').disabled).toBe(false);
  });

  it('marks the required fields as required for assistive technology', async () => {
    await act(async () => {
      root!.render(<VideoAgentPage />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const media = container!.querySelector('#video-agent-media') as HTMLInputElement;
    expect(media.getAttribute('required')).not.toBeNull();
    expect(media.getAttribute('aria-required')).toBe('true');
  });
});
