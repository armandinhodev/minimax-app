import React, { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScreenStore } from '@/components/shared/screen-store';

import VideoAgentPage from './page';

const authClientMocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
}));

vi.mock('@/lib/auth-client', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/auth-client')>(),
  ...authClientMocks,
}));

vi.mock('@chakra-ui/react', () => ({
  Box: ({ children, as: Component = 'div', role, 'aria-label': ariaLabel, ...props }: {
    children?: ReactNode;
    as?: keyof JSX.IntrinsicElements;
    role?: string;
    'aria-label'?: string;
  } & Record<string, unknown>) => {
    void props;
    return <Component role={role} aria-label={ariaLabel}>{children}</Component>;
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
    mediaCount: 1,
  },
  {
    id: '394514820878671878',
    name: 'Anime Life Sim',
    description: 'An anime gameplay video.',
    requiresMedia: false,
    requiresText: true,
    mediaCount: 0,
  },
  {
    id: '401431836934868999',
    name: '3D character product presentation',
    description: 'A custom 3D character explaining your product.',
    requiresMedia: true,
    requiresText: true,
    mediaCount: 3,
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
    useScreenStore.getState().resetAll();
    useScreenStore.getState().resetAll();
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 512, height: 512, close: vi.fn() })));
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = vi.fn(() => 'blob:video-agent-original');
      static revokeObjectURL = vi.fn();
    });
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
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('keeps Reset disabled while a request is in flight', () => {
    useScreenStore.getState().setValue('video-agent:isCreating', true);

    act(() => {
      root!.render(<VideoAgentPage />);
    });

    const reset = Array.from(container!.querySelectorAll('button')).find(
      (button) => button.textContent === 'Reset',
    ) as HTMLButtonElement | undefined;

    expect(reset?.disabled).toBe(true);
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

  function attachFile(method: 'Paste image' | 'Upload', file: File) {
    act(() => findButton(container!, method).click());
    if (method === 'Upload') {
      const input = container!.querySelector('input[type="file"]')!;
      Object.defineProperty(input, 'files', { value: [file] });
      act(() => input.dispatchEvent(new Event('change', { bubbles: true })));
    } else {
      const input = container!.querySelector('[aria-label="Paste image"]')!;
      const event = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: { files: [file] } });
      act(() => input.dispatchEvent(event));
    }
  }

  it.each(['Paste image', 'Upload'] as const)('uses the original for %s and only sends Base64 on Create video', async (method) => {
    await act(async () => root!.render(<VideoAgentPage />));
    attachFile(method, new File(['abc'], 'pet.png', { type: 'image/png' }));

    expect(container!.querySelector('img')?.getAttribute('src')).toBe('blob:video-agent-original');
    expect(container!.textContent).toContain('pet.png');
    expect(authClientMocks.authFetch.mock.calls.map(([url]) => url)).toEqual(['/api/minimax/video-agent/templates']);

    await act(async () => {
      findButton(container!, 'Create video').click();
      await vi.waitFor(() => expect(authClientMocks.authFetch).toHaveBeenCalledTimes(2));
    });
    const [, request] = authClientMocks.authFetch.mock.calls[1];
    expect(authClientMocks.authFetch.mock.calls[1][0]).toBe('/api/minimax/video-agent/generations');
    expect(JSON.parse(request.body)).toMatchObject({ mediaInputs: [{ value: 'data:image/png;base64,YWJj' }] });
    expect(container!.textContent).toContain('Task 401047179385389059 created');
  });

  it('does not offer the MiniMax picker or submit a saved library ID', async () => {
    useScreenStore.getState().setValue('video-agent:mediaUrl', 'mm_file://99');
    await act(async () => root!.render(<VideoAgentPage />));
    expect([...container!.querySelectorAll('button')].some((button) => button.textContent === 'MiniMax')).toBe(false);
    expect(container!.textContent).toContain('Paste or upload the original');
    expect(findButton(container!, 'Create video').disabled).toBe(true);
    expect(authClientMocks.authFetch).toHaveBeenCalledTimes(1);
    for (const method of ['Paste image', 'Upload']) {
      act(() => findButton(container!, method).click());
      expect(container!.textContent).not.toContain('Paste or upload the original');
      expect(findButton(container!, 'Create video').disabled).toBe(true);
    }
    act(() => findButton(container!, 'URL').click());
    expect(container!.textContent).toContain('Paste or upload the original');
  });

  it.each([
    { width: 512, height: 300, message: 'shorter side must be greater than 300 px' },
    { width: 1280, height: 400, message: 'aspect ratio must be between 2:5 and 5:2' },
  ])('rejects a $width by $height image before sending it', async ({ width, height, message }) => {
    const close = vi.fn();
    vi.mocked(createImageBitmap).mockResolvedValue({ width, height, close } as ImageBitmap);
    await act(async () => root!.render(<VideoAgentPage />));
    attachFile('Upload', new File(['abc'], 'pet.png', { type: 'image/png' }));
    await act(async () => findButton(container!, 'Create video').click());
    expect(container!.textContent).toContain(message);
    expect(close).toHaveBeenCalledOnce();
    expect(authClientMocks.authFetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    { type: 'image/heic', size: 3, message: 'Choose a JPEG, PNG or WebP image' },
    { type: 'image/png', size: 20 * 1024 * 1024, message: 'smaller than 20 MB' },
  ])('blocks unsupported or oversized local images ($type, $size bytes)', async ({ type, size, message }) => {
    await act(async () => root!.render(<VideoAgentPage />));
    const file = new File(['abc'], 'pet.png', { type });
    Object.defineProperty(file, 'size', { value: size });
    attachFile('Upload', file);
    expect(container!.textContent).toContain(message);
    expect(container!.querySelector('img')).toBeNull();
    expect(findButton(container!, 'Create video').disabled).toBe(true);
    expect(authClientMocks.authFetch).toHaveBeenCalledTimes(1);
  });

  it('collects exactly three images and a prompt for the 3D template', async () => {
    authClientMocks.authFetch.mockImplementation(async (url: string) => url.endsWith('/templates')
      ? Response.json({ templates: TEMPLATES })
      : Response.json({ taskId: '3d-task' }));
    await act(async () => root!.render(<VideoAgentPage />));
    act(() => changeSelect(container!.querySelector('#video-agent-template')!, '401431836934868999'));

    expect(container!.textContent).toContain('0 of 3 images');
    expect(findButton(container!, 'Create video').disabled).toBe(true);

    act(() => findButton(container!, 'Upload').click());
    const input = container!.querySelector('input[type="file"]')!;
    for (let count = 1; count <= 2; count++) {
      Object.defineProperty(input, 'files', { configurable: true, value: [new File([`${count}`], `view-${count}.png`, { type: 'image/png' })] });
      act(() => input.dispatchEvent(new Event('change', { bubbles: true })));
    }
    expect(container!.textContent).toContain('2 of 3 images');
    expect(findButton(container!, 'Create video').disabled).toBe(true);

    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['3'], 'view-3.png', { type: 'image/png' })] });
    act(() => input.dispatchEvent(new Event('change', { bubbles: true })));
    const prompt = container!.querySelector<HTMLTextAreaElement>('#video-agent-text')!;
    act(() => {
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set?.call(prompt, 'A friendly character presents the bottle.');
      prompt.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container!.textContent).toContain('3 of 3 images');
    expect(findButton(container!, 'Create video').disabled).toBe(false);

    await act(async () => {
      findButton(container!, 'Create video').click();
      await vi.waitFor(() => expect(authClientMocks.authFetch).toHaveBeenCalledTimes(2));
    });
    const [, request] = authClientMocks.authFetch.mock.calls[1];
    const body = JSON.parse(request.body);
    expect(body.mediaInputs).toHaveLength(3);
    expect(body.mediaInputs.every((input: { value: string }) => input.value.startsWith('data:image/png;base64,'))).toBe(true);
    expect(body.textInputs).toEqual([{ value: 'A friendly character presents the bottle.' }]);
  });

  it('does not send a previously selected image with a text-only template', async () => {
    await act(async () => root!.render(<VideoAgentPage />));
    attachFile('Upload', new File(['abc'], 'pet.png', { type: 'image/png' }));
    act(() => changeSelect(container!.querySelector('#video-agent-template')!, '394514820878671878'));
    const text = container!.querySelector<HTMLTextAreaElement>('#video-agent-text')!;
    act(() => {
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set?.call(text, 'A fixture');
      text.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => findButton(container!, 'Create video').click());
    expect(createImageBitmap).not.toHaveBeenCalled();
    const [, request] = authClientMocks.authFetch.mock.calls[1];
    expect(JSON.parse(request.body)).toMatchObject({ mediaInputs: [], textInputs: [{ value: 'A fixture' }] });
  });

  it('shows a MiniMax 2013 as rejected inputs rather than a service outage', async () => {
    authClientMocks.authFetch.mockImplementation(async (url: string) => url.endsWith('/templates')
      ? Response.json({ templates: TEMPLATES })
      : Response.json({ error: 'MiniMax is temporarily unavailable (HTTP 502).', code: 2013, details: { upstreamMessage: 'raw provider body' } }, { status: 503 }));
    await act(async () => root!.render(<VideoAgentPage />));
    act(() => changeInput(container!.querySelector('#video-agent-media')!, 'https://example.com/photo.jpg'));
    await act(async () => findButton(container!, 'Create video').click());
    expect(container!.textContent).toContain('MiniMax rejected the inputs (2013)');
    expect(container!.textContent).not.toContain('temporarily unavailable');
    expect(container!.textContent).not.toContain('raw provider body');
    const [, request] = authClientMocks.authFetch.mock.calls[1];
    expect(JSON.parse(request.body).mediaInputs).toEqual([{ value: 'https://example.com/photo.jpg' }]);
  });

  it('includes the provider count detail when MiniMax rejects the input count', async () => {
    authClientMocks.authFetch.mockImplementation(async (url: string) => url.endsWith('/templates')
      ? Response.json({ templates: TEMPLATES })
      : Response.json({
        error: 'MiniMax is temporarily unavailable (HTTP 502).',
        code: 2013,
        details: { upstreamMessage: 'invalid params, image input count not match, expected: 3, actual: 1' },
      }, { status: 503 }));
    await act(async () => root!.render(<VideoAgentPage />));
    act(() => changeInput(container!.querySelector('#video-agent-media')!, 'https://example.com/photo.jpg'));
    await act(async () => findButton(container!, 'Create video').click());
    expect(container!.textContent).toContain('MiniMax rejected the inputs (2013).');
    expect(container!.textContent).toContain('image input count not match, expected: 3, actual: 1');
  });

  it.each([
    [1008, 'insufficient balance'],
    [1004, 'rejected the API credentials'],
    [2049, 'rejected the API credentials'],
    [1002, 'rate-limited the request'],
  ] as const)('shows guidance for MiniMax code %i', async (code, message) => {
    authClientMocks.authFetch.mockImplementation(async (url: string) => url.endsWith('/templates')
      ? Response.json({ templates: TEMPLATES })
      : Response.json({ code, details: { upstreamMessage: 'raw provider body' } }, { status: 503 }));
    await act(async () => root!.render(<VideoAgentPage />));
    act(() => changeInput(container!.querySelector('#video-agent-media')!, 'https://example.com/photo.jpg'));
    await act(async () => findButton(container!, 'Create video').click());
    expect(container!.textContent).toContain(`${message} (${code})`);
    expect(container!.textContent).not.toContain('raw provider body');
  });

  it('checks the task after creation and shows the generated clip when it succeeds', async () => {
    vi.useFakeTimers();
    const taskId = '401047179385389059';
    let queryCount = 0;
    authClientMocks.authFetch.mockImplementation(async (url: string) => {
      if (url.endsWith('/templates')) return Response.json({ templates: TEMPLATES });
      if (url.endsWith(`/${taskId}`)) return ++queryCount === 1
        ? Response.json({ taskId, status: 'processing' })
        : Response.json({ taskId, status: 'succeeded', videoUrl: 'https://example.com/clip.mp4' });
      return Response.json({ taskId });
    });
    await act(async () => root!.render(<VideoAgentPage />));
    act(() => changeInput(container!.querySelector('#video-agent-media')!, 'https://example.com/photo.jpg'));
    await act(async () => {
      const button = findButton(container!, 'Create video');
      button.click();
      button.click();
    });
    expect(authClientMocks.authFetch.mock.calls.filter(([url]) => url.endsWith('/generations'))).toHaveLength(1);
    expect(findButton(container!, 'Create video').disabled).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(container!.textContent).toContain('processing');
    expect(container!.querySelector('video')).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(5000));

    expect(container!.querySelector('video')?.getAttribute('src')).toBe('https://example.com/clip.mp4');
    await act(async () => vi.advanceTimersByTimeAsync(10000));
    expect(queryCount).toBe(2);
    expect(findButton(container!, 'Create video').disabled).toBe(false);
  });

  it.each([
    { label: 'terminal failure', response: () => ({ taskId: 'fixture-task', status: 'failed' }), status: 200, message: 'The task failed.', canCreate: true },
    { label: 'status query error', response: () => ({ error: 'Could not query the task' }), status: 503, message: 'Could not query the task', canCreate: false },
  ])('stops polling after $label', async ({ response, status, message, canCreate }) => {
    vi.useFakeTimers();
    const get = vi.fn(() => Response.json(response(), { status }));
    authClientMocks.authFetch.mockImplementation(async (url: string) => {
      if (url.endsWith('/templates')) return Response.json({ templates: TEMPLATES });
      if (url.endsWith('/fixture-task')) return get();
      return Response.json({ taskId: 'fixture-task' });
    });
    await act(async () => root!.render(<VideoAgentPage />));
    act(() => changeInput(container!.querySelector('#video-agent-media')!, 'https://example.com/photo.jpg'));
    await act(async () => findButton(container!, 'Create video').click());
    await act(async () => vi.advanceTimersByTimeAsync(15000));
    expect(get).toHaveBeenCalledOnce();
    expect(container!.textContent).toContain(message);
    expect(findButton(container!, 'Reset').disabled).toBe(false);
    expect(findButton(container!, 'Create video').disabled).toBe(!canCreate);
  });

  it('aborts an in-flight status check on unmount and does not apply its late result', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    let finish!: (response: Response) => void;
    authClientMocks.authFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/templates')) return Response.json({ templates: TEMPLATES });
      if (url.endsWith('/fixture-task')) {
        signal = init?.signal ?? undefined;
        return new Promise<Response>((resolve) => { finish = resolve; });
      }
      return Response.json({ taskId: 'fixture-task' });
    });
    await act(async () => root!.render(<VideoAgentPage />));
    act(() => changeInput(container!.querySelector('#video-agent-media')!, 'https://example.com/photo.jpg'));
    await act(async () => findButton(container!, 'Create video').click());
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(signal?.aborted).toBe(false);
    act(() => root!.render(null));
    expect(signal?.aborted).toBe(true);
    await act(async () => finish(Response.json({ taskId: 'fixture-task', status: 'succeeded' })));
    expect(useScreenStore.getState().values['video-agent:task']).toMatchObject({ status: 'preparing' });
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

  it('marks the required fields visibly, so the obligation is not only for the screen reader', async () => {
    await act(async () => {
      root!.render(<VideoAgentPage />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    // The label names the field and marks it; the legend explains the mark.
    const label = container!.querySelector('label[for="video-agent-media"]');
    expect(label?.textContent).toContain('Image');
    expect(label?.textContent).toContain('*');
    expect(container!.textContent).toContain('Fields marked * are required.');
  });
});
