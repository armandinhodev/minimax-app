import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useScreenStore } from '@/components/shared/screen-store';
import { MediaReferenceActions } from './MediaReferenceActions';
import { MediaReferenceField } from './MediaReferenceField';
import { rememberReferencePreview } from './media-reference-previews';

const authClientMocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
}));

vi.mock('@/lib/auth-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-client')>();
  return { ...actual, authFetch: authClientMocks.authFetch };
});

vi.mock('@chakra-ui/react', () => ({
  Box: ({ children, as: Component = 'div', ...props }: { children?: React.ReactNode; as?: keyof JSX.IntrinsicElements } & Record<string, unknown>) => {
    void props;
    return <Component>{children}</Component>;
  },
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, variant, size, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => {
    void variant;
    void size;
    return <button {...props}>{children}</button>;
  },
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children?: React.ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
}));

vi.mock('@/components/ui/icons', () => ({
  Icon: () => null,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find(
    (item) => item.textContent === label || item.getAttribute('aria-label') === label,
  );
  if (!button) throw new Error(`Button not found: ${label}`);
  return button as HTMLButtonElement;
}

function selectFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function pasteImage(input: HTMLInputElement, files: File[] = []) {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { files } });
  input.dispatchEvent(event);
}

function PasteHarness({ multiple = false, maxItems, initial = 'mm_file://1' }: {
  multiple?: boolean;
  maxItems?: number;
  initial?: string;
}) {
  const [value, setValue] = React.useState(initial);
  return (
    <>
      <MediaReferenceField
        purpose="image_generation_input"
        label="reference image"
        value={value}
        onChange={setValue}
        multiple={multiple}
        maxItems={maxItems}
      />
      <output>{value}</output>
    </>
  );
}

describe('MediaReferenceActions', () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;
  const createObjectURL = vi.fn();
  const revokeObjectURL = vi.fn();
  const request = vi.fn();

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    useScreenStore.getState().resetAll();
    createObjectURL.mockReturnValue('blob:local-reference');
    vi.stubGlobal('fetch', request);
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
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
    container = null;
    root = null;
    vi.unstubAllGlobals();
  });

  function openPaste(container: HTMLElement) {
    act(() => findButton(container, 'Paste image').click());
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Paste reference image"]');
    if (!input) throw new Error('Clipboard input not found');
    return input;
  }

  it.each([
    { multiple: false, expected: 'mm_file://123456' },
    { multiple: true, expected: 'mm_file://1, mm_file://123456' },
  ])('focuses the paste target and attaches the copied image (multiple: $multiple)', async ({ multiple, expected }) => {
    authClientMocks.authFetch.mockResolvedValue(Response.json({ fileId: '123456' }));
    act(() => root!.render(<PasteHarness multiple={multiple} maxItems={2} />));

    const input = openPaste(container!);
    expect(document.activeElement).toBe(input);
    expect(container!.textContent).toContain('upload it to MiniMax');

    const original = new File(['x'], 'screenshot.png', { type: 'image/png' });
    await act(async () => pasteImage(input, [original]));

    expect(authClientMocks.authFetch).toHaveBeenCalledTimes(1);
    const [url, options] = authClientMocks.authFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/minimax/files');
    expect(options.method).toBe('POST');
    const body = options.body as FormData;
    expect(body.get('purpose')).toBe('image_generation_input');
    expect((body.get('file') as File).name).toBe('screenshot.png');
    expect(container!.querySelector('output')?.textContent).toBe(expected);
    expect(container!.textContent).toContain('screenshot.png');
    expect(container!.querySelector('img')?.getAttribute('src')).toBe('blob:local-reference');
    expect(createObjectURL).toHaveBeenCalledWith(original);
    expect(request).not.toHaveBeenCalled();
  });

  it('previews the selected upload from disk and releases its object URL when removed', async () => {
    authClientMocks.authFetch.mockResolvedValue(Response.json({ fileId: '123456' }));
    act(() => root!.render(<PasteHarness />));
    act(() => findButton(container!, 'Upload').click());
    const input = container!.querySelector<HTMLInputElement>('input[type="file"]')!;
    const original = new File(['from disk'], 'reference.png', { type: 'image/png' });
    await act(async () => selectFile(input, original));

    expect(container!.querySelector('img')?.getAttribute('src')).toBe('blob:local-reference');
    expect(createObjectURL).toHaveBeenCalledWith(original);
    expect(request).not.toHaveBeenCalled();
    expect(container!.querySelector('output')?.textContent).toBe('mm_file://123456');
    act(() => findButton(container!, 'Remove reference image').click());
    expect(container!.querySelector('img')).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:local-reference');
  });

  it('does not try to download a library reference whose original is unavailable', () => {
    act(() => root!.render(<PasteHarness />));
    expect(container!.textContent).toContain('No local preview');
    expect(container!.querySelector('output')?.textContent).toBe('mm_file://1');
    expect(container!.querySelector('img')).toBeNull();
    expect(request).not.toHaveBeenCalled();
    expect(authClientMocks.authFetch).not.toHaveBeenCalled();
  });

  it('recreates a preview after navigating back and clears it when the tab session is reset', async () => {
    authClientMocks.authFetch.mockResolvedValue(Response.json({ fileId: '123456' }));
    act(() => root!.render(<PasteHarness />));
    const original = new File(['image'], 'frame.png', { type: 'image/png' });
    const input = openPaste(container!);
    await act(async () => pasteImage(input, [original]));

    act(() => root!.render(null));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:local-reference');
    createObjectURL.mockReturnValue('blob:recreated-preview');
    act(() => root!.render(<PasteHarness initial="mm_file://123456" />));
    expect(container!.querySelector('img')?.getAttribute('src')).toBe('blob:recreated-preview');
    expect(createObjectURL).toHaveBeenLastCalledWith(original);

    act(() => useScreenStore.getState().resetAll());
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:recreated-preview');
    expect(container!.textContent).toContain('No local preview');
    expect(container!.querySelector('output')?.textContent).toBe('mm_file://123456');
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    { limit: 'count', size: 1, maxRetained: 32 },
    { limit: 'total bytes', size: 20 * 1024 * 1024, maxRetained: 3 },
  ])('drops the oldest original at the cache $limit limit without losing its reference', ({ size, maxRetained }) => {
    const original = new File(['old'], 'old.png', { type: 'image/png' });
    const newest = new File(['new'], 'new.png', { type: 'image/png' });
    Object.defineProperty(original, 'size', { value: size });
    Object.defineProperty(newest, 'size', { value: size });
    rememberReferencePreview('mm_file://1', original);
    act(() => root!.render(<PasteHarness multiple initial="mm_file://1, mm_file://2" />));
    expect(container!.querySelectorAll('img')).toHaveLength(1);
    act(() => {
      for (let i = 2; i <= maxRetained; i++) rememberReferencePreview(`mm_file://${i}`, newest);
    });
    expect(container!.querySelectorAll('img')).toHaveLength(2);
    act(() => rememberReferencePreview(`mm_file://${maxRetained + 1}`, newest));
    expect(container!.querySelectorAll('img')).toHaveLength(1);
    expect(container!.textContent).toContain('No local preview');
    expect(container!.querySelector('output')?.textContent).toBe('mm_file://1, mm_file://2');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:local-reference');
  });

  it.each([
    { kind: 'text', file: undefined, message: 'Copy an image' },
    { kind: 'unsupported image', file: new File(['x'], 'image.gif', { type: 'image/gif' }), message: 'must be a JPG' },
    { kind: 'oversized image', file: new File(['x'], 'large.png', { type: 'image/png' }), size: 21 * 1024 * 1024, message: 'larger than 20 MB' },
  ])('rejects $kind from the clipboard without uploading or replacing the reference', async ({ file, size, message }) => {
    if (file && size) Object.defineProperty(file, 'size', { value: size });
    act(() => root!.render(<PasteHarness />));
    const input = openPaste(container!);

    await act(async () => pasteImage(input, file ? [file] : []));

    expect(container!.textContent).toContain(message);
    expect(container!.querySelector('output')?.textContent).toBe('mm_file://1');
    expect(authClientMocks.authFetch).not.toHaveBeenCalled();
  });

  it('does not upload a pasted image if the field is already full', async () => {
    act(() => root!.render(<PasteHarness multiple maxItems={1} />));
    const input = openPaste(container!);

    await act(async () => pasteImage(input, [new File(['x'], 'frame.png', { type: 'image/png' })]));

    expect(container!.textContent).toContain('Remove an image before pasting another one.');
    expect(container!.querySelector('output')?.textContent).toBe('mm_file://1');
    expect(authClientMocks.authFetch).not.toHaveBeenCalled();
  });

  it('shows the paste upload error and keeps the existing reference', async () => {
    authClientMocks.authFetch.mockResolvedValue(Response.json({ error: 'Upload unavailable' }, { status: 500 }));
    act(() => root!.render(<PasteHarness />));
    const input = openPaste(container!);

    await act(async () => pasteImage(input, [new File(['x'], 'frame.png', { type: 'image/png' })]));

    expect(container!.textContent).toContain('Upload unavailable');
    expect(container!.querySelector('output')?.textContent).toBe('mm_file://1');
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('uploads only once while a paste is pending and preserves edits to the attachment list', async () => {
    let finish!: (response: Response) => void;
    authClientMocks.authFetch.mockReturnValue(new Promise<Response>((resolve) => { finish = resolve; }));
    act(() => root!.render(<PasteHarness multiple maxItems={2} />));
    const input = openPaste(container!);
    const image = new File(['x'], 'frame.png', { type: 'image/png' });

    act(() => {
      pasteImage(input, [image]);
      pasteImage(input, [image]);
    });
    expect(authClientMocks.authFetch).toHaveBeenCalledTimes(1);
    expect(container!.textContent).toContain('Uploading…');
    act(() => findButton(container!, 'Remove reference image 1').click());
    await act(async () => finish(Response.json({ fileId: '123456' })));

    expect(container!.querySelector('output')?.textContent).toBe('mm_file://123456');
  });

  it('uploads an image with the purpose of the destination and returns the mm_file reference', async () => {
    authClientMocks.authFetch.mockResolvedValue(Response.json({ fileId: '123456' }));
    const onUse = vi.fn();

    act(() => {
      root!.render(<MediaReferenceActions method="upload" purpose="video_generation_input" label="reference image" onUse={onUse} />);
    });

    const input = container!.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      selectFile(input, new File(['x'], 'frame.png', { type: 'image/png' }));
    });

    const [url, options] = authClientMocks.authFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/minimax/files');
    expect(options.method).toBe('POST');
    const body = options.body as FormData;
    expect(body.get('purpose')).toBe('video_generation_input');
    expect((body.get('file') as File).name).toBe('frame.png');
    expect(onUse).toHaveBeenCalledWith({ reference: 'mm_file://123456', fileName: 'frame.png', size: 1 });
  });

  it('rejects a file that is not a supported image without calling the API', async () => {
    const onUse = vi.fn();

    act(() => {
      root!.render(<MediaReferenceActions method="upload" purpose="image_generation_input" label="reference image" onUse={onUse} />);
    });

    const input = container!.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      selectFile(input, new File(['x'], 'notes.txt', { type: 'text/plain' }));
    });

    expect(authClientMocks.authFetch).not.toHaveBeenCalled();
    expect(onUse).not.toHaveBeenCalled();
    expect(container!.textContent).toContain('must be a JPG');
  });

  it('rejects an image over the upload limit without calling the API', async () => {
    act(() => {
      root!.render(<MediaReferenceActions method="upload" purpose="image_generation_input" label="reference image" onUse={vi.fn()} />);
    });

    const input = container!.querySelector('input[type="file"]') as HTMLInputElement;
    const oversized = new File(['x'], 'huge.png', { type: 'image/png' });
    Object.defineProperty(oversized, 'size', { value: 21 * 1024 * 1024 });

    await act(async () => {
      selectFile(input, oversized);
    });

    expect(authClientMocks.authFetch).not.toHaveBeenCalled();
    expect(container!.textContent).toContain('larger than 20 MB');
  });

  it('shows the API error when the upload fails', async () => {
    authClientMocks.authFetch.mockResolvedValue(
      new Response(JSON.stringify({
        error: 'An unexpected error occurred. Please try again.',
        code: 2013,
        details: { upstreamStatus: 200, upstreamMessage: 'invalid param: image size 1x1' },
      }), { status: 500 }),
    );

    act(() => {
      root!.render(<MediaReferenceActions method="upload" purpose="video_generation_input" label="reference image" onUse={vi.fn()} />);
    });

    const input = container!.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      selectFile(input, new File(['x'], 'frame.png', { type: 'image/png' }));
    });

    expect(container!.textContent).toContain('An unexpected error occurred');
    expect(container!.textContent).toContain('invalid param: image size 1x1');
  });

  it.each(['upload', 'paste'] as const)('does not offer the MiniMax file library in %s mode', (method) => {
    act(() => {
      root!.render(<MediaReferenceActions method={method} purpose="video_generation_input" label="reference image" onUse={vi.fn()} />);
    });

    expect(container!.textContent).not.toContain('From MiniMax');
    expect(container!.textContent).not.toContain('Choose');
    expect(authClientMocks.authFetch).not.toHaveBeenCalled();
  });
});
