import React, { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScreenStore } from '@/components/shared/screen-store';
import MusicCoverPreprocessPage from './page';

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

function changeInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function selectFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('MusicCoverPreprocessPage', () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;
  const originalFileReader = globalThis.FileReader;
  const originalAudio = globalThis.Audio;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  let audioDurationSeconds = 12;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    audioDurationSeconds = 12;
    class MockFileReader {
      result: string | null = null;
      onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() {
        this.result = 'data:audio/mpeg;base64,AAEC';
        this.onload?.(new ProgressEvent('load') as ProgressEvent<FileReader>);
      }
    }
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;
    class MockAudio {
      duration = audioDurationSeconds;
      preload = '';
      src = '';
      private readonly listeners = new Map<string, EventListener>();

      addEventListener(type: string, listener: EventListener) {
        this.listeners.set(type, listener);
      }

      removeEventListener(type: string, listener: EventListener) {
        if (this.listeners.get(type) === listener) {
          this.listeners.delete(type);
        }
      }

      load() {
        this.listeners.get('loadedmetadata')?.(new Event('loadedmetadata'));
      }
    }
    globalThis.Audio = MockAudio as unknown as typeof Audio;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:reference-audio') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    globalThis.FileReader = originalFileReader;
    globalThis.Audio = originalAudio;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectURL });
    container?.remove();
    root = null;
    container = null;
  });

  it('keeps Reset disabled while a request is in flight', () => {
    useScreenStore.getState().setValue('cover-preprocess:isLoading', true);

    act(() => {
      root!.render(<MusicCoverPreprocessPage />);
    });

    const reset = Array.from(container!.querySelectorAll('button')).find(
      (button) => button.textContent === 'Reset',
    ) as HTMLButtonElement | undefined;

    expect(reset?.disabled).toBe(true);
  });

  it('preprocesses a reference audio URL', async () => {
    authClientMocks.authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        coverFeatureId: 'cover-feature-1',
        coverPreprocessId: 'library-cover-preprocess-1',
        formattedLyrics: '[Verse]\nCity lights',
        structureResult: '{"sections":["Verse"]}',
        audioDurationSeconds: 42,
        traceId: 'trace-cover-1',
        metadata: { status: 0, message: 'success' },
      }),
    });

    act(() => {
      root!.render(<MusicCoverPreprocessPage />);
    });

    const audioUrl = container!.querySelector('#cover-audio-url') as HTMLInputElement;
    act(() => {
      changeInput(audioUrl, 'https://example.com/reference.mp3');
    });

    const button = Array.from(container!.querySelectorAll('button')).find((element) => element.textContent === 'Preprocess cover audio');
    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(authClientMocks.authFetch).toHaveBeenCalledWith('/api/minimax/music/generations/cover-preprocess', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'music-cover',
        audioUrl: 'https://example.com/reference.mp3',
        audioBase64: '',
      }),
    }));
    expect(container!.textContent).toContain('cover-feature-1');
    expect(container!.textContent).toContain('Valid for');
    expect(container!.textContent).toContain('24 hours');
    const coverGenerationLink = container!.querySelector('a[href^="/music?"]') as HTMLAnchorElement;
    const coverGenerationUrl = new URL(coverGenerationLink.getAttribute('href') ?? '', 'http://localhost');
    expect(coverGenerationLink.textContent).toBe('Use in cover generation');
    expect(coverGenerationUrl.searchParams.get('coverPreprocessId')).toBe('library-cover-preprocess-1');
    expect(coverGenerationUrl.searchParams.has('coverFeatureId')).toBe(false);
    expect(coverGenerationUrl.searchParams.has('lyrics')).toBe(false);
  });

  it('converts a local audio upload to base64 without adding persistence calls', async () => {
    authClientMocks.authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        coverFeatureId: 'cover-feature-base64',
        formattedLyrics: '',
        structureResult: '',
        audioDurationSeconds: 12,
        metadata: { status: 0 },
      }),
    });

    const setItemSpy = vi.spyOn(window.localStorage.__proto__, 'setItem');

    act(() => {
      root!.render(<MusicCoverPreprocessPage />);
    });

    const audioFile = container!.querySelector('#cover-audio-file') as HTMLInputElement;
    await act(async () => {
      selectFile(audioFile, new File(['abc'], 'reference.mp3', { type: 'audio/mpeg' }));
    });

    const button = Array.from(container!.querySelectorAll('button')).find((element) => element.textContent === 'Preprocess cover audio');
    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(JSON.parse(authClientMocks.authFetch.mock.calls[0][1].body)).toEqual({
      model: 'music-cover',
      audioUrl: '',
      audioBase64: 'AAEC',
    });
    expect(setItemSpy).not.toHaveBeenCalled();
    setItemSpy.mockRestore();
  });

  it('rejects local audio uploads shorter than 6 seconds before preprocessing', async () => {
    audioDurationSeconds = 5;

    act(() => {
      root!.render(<MusicCoverPreprocessPage />);
    });

    const audioFile = container!.querySelector('#cover-audio-file') as HTMLInputElement;
    await act(async () => {
      selectFile(audioFile, new File(['abc'], 'reference.mp3', { type: 'audio/mpeg' }));
    });

    expect(container!.textContent).toContain('Reference audio must be at least 6 seconds long.');
    expect(authClientMocks.authFetch).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:reference-audio');
  });

  it('rejects local audio uploads longer than 6 minutes before preprocessing', async () => {
    audioDurationSeconds = 361;

    act(() => {
      root!.render(<MusicCoverPreprocessPage />);
    });

    const audioFile = container!.querySelector('#cover-audio-file') as HTMLInputElement;
    await act(async () => {
      selectFile(audioFile, new File(['abc'], 'reference.mp3', { type: 'audio/mpeg' }));
    });

    expect(container!.textContent).toContain('Reference audio must be no longer than 6 minutes.');
    expect(authClientMocks.authFetch).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:reference-audio');
  });

  it('blocks submitting both URL and local upload sources', async () => {
    act(() => {
      root!.render(<MusicCoverPreprocessPage />);
    });

    const audioUrl = container!.querySelector('#cover-audio-url') as HTMLInputElement;
    const audioFile = container!.querySelector('#cover-audio-file') as HTMLInputElement;
    await act(async () => {
      changeInput(audioUrl, 'https://example.com/reference.mp3');
      selectFile(audioFile, new File(['abc'], 'reference.mp3', { type: 'audio/mpeg' }));
    });

    expect(container!.textContent).toContain('Use either a reference audio URL or a local upload, not both.');
    const button = Array.from(container!.querySelectorAll('button')).find((element) => element.textContent === 'Preprocess cover audio') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(authClientMocks.authFetch).not.toHaveBeenCalled();
  });
});
