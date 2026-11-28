import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_VIDEO_MEDIA, type VideoMediaValues } from './video-options';
import { VideoMediaFields } from './VideoMediaFields';

const authClientMocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
}));

vi.mock('@/lib/auth-client', () => authClientMocks);

vi.mock('@chakra-ui/react', () => ({
  Box: ({ children, as: Component = 'div', role, 'aria-label': ariaLabel, ...props }: {
    children?: React.ReactNode;
    as?: keyof JSX.IntrinsicElements;
    role?: string;
    'aria-label'?: string;
  } & Record<string, unknown>) => {
    void props;
    return <Component role={role} aria-label={ariaLabel}>{children}</Component>;
  },
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, variant, size, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => {
    void variant;
    void size;
    return <button {...props}>{children}</button>;
  },
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
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

vi.mock('@/components/media/MediaReferencePreview', () => ({
  MediaReferencePreview: () => null,
}));

function Harness({ initial, onError }: { initial?: Partial<VideoMediaValues>; onError?: (message: string) => void }) {
  const [values, setValues] = React.useState<VideoMediaValues>({ ...EMPTY_VIDEO_MEDIA, ...initial });

  return (
    <VideoMediaFields
      idPrefix="test"
      values={values}
      onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
      onMediaError={onError}
    />
  );
}

function selectFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}


function chooseMethod(container: HTMLElement, label: string, method: 'URL' | 'Upload' | 'MiniMax') {
  const group = container.querySelector(`[aria-label="Choose how to add the ${label}"]`);
  if (!group) throw new Error(`No method group for ${label}`);
  const chip = Array.from(group.querySelectorAll('button')).find((button) => button.textContent === method);
  if (!chip) throw new Error(`No ${method} chip for ${label}`);
  chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function readInput(container: HTMLElement, id: string): string {
  const input = container.querySelector(`#${id}`) as HTMLInputElement | null;
  return input?.value ?? '';
}

describe('VideoMediaFields', () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    authClientMocks.authFetch.mockResolvedValue(Response.json({ fileId: '2' }));
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
  });

  it('replaces the first frame with the uploaded MiniMax file', async () => {
    act(() => {
      root!.render(<Harness initial={{ firstFrame: 'https://cdn.example.com/old.png' }} />);
    });
    act(() => {
      chooseMethod(container!, 'first frame', 'Upload');
    });

    const input = container!.querySelector('input[aria-label="first frame file"]') as HTMLInputElement;
    await act(async () => {
      selectFile(input, new File(['x'], 'frame.png', { type: 'image/png' }));
      await Promise.resolve();
    });

    act(() => {
      chooseMethod(container!, 'first frame', 'URL');
    });
    expect(readInput(container!, 'test-first-frame')).toBe('mm_file://2');
  });

  it('appends an uploaded reference image to the comma separated list', async () => {
    act(() => {
      root!.render(<Harness initial={{ referenceImages: 'mm_file://1' }} />);
    });
    act(() => {
      chooseMethod(container!, 'reference image', 'Upload');
    });

    const input = container!.querySelector('input[aria-label="reference image file"]') as HTMLInputElement;
    await act(async () => {
      selectFile(input, new File(['x'], 'reference.png', { type: 'image/png' }));
      await Promise.resolve();
    });

    act(() => {
      chooseMethod(container!, 'reference image', 'URL');
    });
    expect(readInput(container!, 'test-reference-images')).toBe('mm_file://1, mm_file://2');
  });

  it('appends next to a data URL without breaking it', async () => {
    const dataUrl = 'data:image/png;base64,AAAA,BBBB';

    act(() => {
      root!.render(<Harness initial={{ referenceImages: dataUrl }} />);
    });
    act(() => {
      chooseMethod(container!, 'reference image', 'Upload');
    });

    const input = container!.querySelector('input[aria-label="reference image file"]') as HTMLInputElement;
    await act(async () => {
      selectFile(input, new File(['x'], 'reference.png', { type: 'image/png' }));
      await Promise.resolve();
    });

    act(() => {
      chooseMethod(container!, 'reference image', 'URL');
    });
    expect(readInput(container!, 'test-reference-images')).toBe(`${dataUrl}, mm_file://2`);
  });

  it('reports the limit instead of adding a tenth reference image', async () => {
    authClientMocks.authFetch.mockResolvedValue(Response.json({ fileId: '10' }));
    const onError = vi.fn();
    const nineReferences = Array.from({ length: 9 }, (_value, index) => `mm_file://${index + 1}`).join(', ');

    act(() => {
      root!.render(<Harness initial={{ referenceImages: nineReferences }} onError={onError} />);
    });
    act(() => {
      chooseMethod(container!, 'reference image', 'Upload');
    });

    const input = container!.querySelector('input[aria-label="reference image file"]') as HTMLInputElement;
    await act(async () => {
      selectFile(input, new File(['x'], 'reference.png', { type: 'image/png' }));
      await Promise.resolve();
    });

    expect(onError).toHaveBeenCalledWith('You can attach at most 9 images.');
    act(() => {
      chooseMethod(container!, 'reference image', 'URL');
    });
    expect(readInput(container!, 'test-reference-images')).toBe(nineReferences);
  });
});
