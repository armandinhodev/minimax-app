import React, { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LibraryGenerationDTO } from '@/application/dto/library/LibraryDTO';
import LibraryPage from './page';


/**
 * The value of a Spec row, bound to its label.
 *
 * Asserting the label and the value separately would pass even if the row
 * was gone: "Voice" appears in plenty of places. This looks the row up.
 */
function specValue(root: HTMLElement, label: string): string | null {
  const row = Array.from(root.querySelectorAll('div')).find((element) => {
    const children = Array.from(element.children);
    return children.length === 2 && children[0].textContent?.trim() === label;
  });
  return row?.children[1]?.textContent?.trim() ?? null;
}

const authClientMocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  parseApiError: vi.fn(async (response: Response) => ({ code: response.status, message: `HTTP ${response.status}` })),
}));

vi.mock('@/lib/auth-client', () => authClientMocks);

vi.mock('@chakra-ui/react', () => ({
  Box: ({ children }: { children?: ReactNode } & Record<string, unknown>) => <div>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, colorPalette, loading, size, variant, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { colorPalette?: string; loading?: boolean; size?: string; variant?: string }) => {
    void colorPalette;
    void loading;
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

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/shared/ErrorDisplay', () => ({
  ErrorDisplay: ({ message }: { message?: string | null }) => <div>{message}</div>,
}));

vi.mock('@/components/shared/TTLCounter', () => ({
  TTLCounter: ({ label }: { label?: string }) => <span>{label}</span>,
}));

vi.mock('@/components/ui/confirmation-dialog', () => ({
  ConfirmationDialog: ({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel,
    cancelLabel = 'Cancel',
    onConfirm,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel?: string;
    onConfirm: () => void;
  }) =>
    open ? (
      <div role="alertdialog" aria-label={title}>
        <p>{description}</p>
        <button type="button" onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </button>
        <button type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
}));

function createGeneration(overrides: Partial<LibraryGenerationDTO> = {}): LibraryGenerationDTO {
  return {
    id: 'generation-1',
    kind: 'tts',
    source: 'text-to-speech',
    status: 'completed',
    title: null,
    prompt: 'Hello from SQLite',
    model: 'speech-2.8-hd',
    providerGenerationId: null,
    providerTaskId: null,
    providerFileId: null,
    metadata: { voiceId: 'voice-a' },
    assets: [
      {
        id: 'asset-1',
        kind: 'audio',
        storageType: 'local_file',
        storageRef: 'audio/generation-1.mp3',
        format: 'mp3',
        mimeType: 'audio/mpeg',
        sizeBytes: 4,
        expiresAt: null,
        metadata: {},
        createdAt: 1,
      },
    ],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe('LibraryPage backend source of truth', () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;
  let generations: LibraryGenerationDTO[] = [];

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    localStorage.clear();
    generations = [];
    authClientMocks.authFetch.mockImplementation(async (url: string, options?: RequestInit) => {
      if (url.startsWith('/api/library/generations?')) {
        return Response.json({ generations });
      }
      if (url.startsWith('/api/library/generations/') && options?.method === 'DELETE') {
        const generationId = decodeURIComponent(url.split('/')[4] ?? '');
        generations = generations.filter((generation) => generation.id !== generationId);
        return Response.json({ deleted: true });
      }
      return Response.json({ error: 'Not found' }, { status: 404 });
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
    localStorage.clear();
    root = null;
    container = null;
  });

  async function renderPage() {
    await act(async () => {
      root!.render(<LibraryPage />);
    });
  }

  it('shows video playback, temporary URL warning and a video-only filter', async () => {
    let downloadedUrl = '';
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { downloadedUrl = this.href; });
    generations = [createGeneration(), createGeneration({
      id: 'video-1', kind: 'video', source: 'video-generation', model: 'MiniMax-H3',
      prompt: 'A seaside video', metadata: { providerStatus: 'succeeded' },
      assets: [{ id: 'video-asset', kind: 'video', storageType: 'provider_url',
        storageRef: 'https://example.com/video.mp4', format: 'mp4', mimeType: 'video/mp4',
        sizeBytes: null, expiresAt: null, metadata: { temporaryUrl: true }, createdAt: 1 }],
    })];
    await renderPage();
    expect(container!.querySelector('video')?.getAttribute('src')).toBe('https://example.com/video.mp4');
    expect(container!.textContent).toContain('Temporary video URL');
    const download = Array.from(container!.querySelectorAll('button')).find((button) => button.textContent === 'Download video');
    act(() => { download!.click(); });
    expect(downloadedUrl).toBe('https://example.com/video.mp4');
    click.mockRestore();
    const filter = Array.from(container!.querySelectorAll('button')).find((button) => button.textContent === 'Videos');
    expect(filter).toBeDefined();
    act(() => { filter!.click(); });
    expect(container!.textContent).toContain('A seaside video');
    expect(container!.textContent).not.toContain('Hello from SQLite');
  });

  it('shows Context-IR text without offering a nonexistent video download', async () => {
    generations = [createGeneration({
      id: 'ir-1', kind: 'video', source: 'video-context-ir', assets: [],
      metadata: { enhancedPrompt: 'An enhanced cinematic prompt', providerStatus: 'succeeded' },
    })];
    await renderPage();
    expect(container!.textContent).toContain('An enhanced cinematic prompt');
    expect(container!.querySelector('video')).toBeNull();
    expect(Array.from(container!.querySelectorAll('button')).some((button) => button.textContent === 'Download video')).toBe(false);
  });

  it('loads backend records only and ignores localStorage history', async () => {
    localStorage.setItem('minimax_speech_history', JSON.stringify([{ id: 'local-1', type: 'tts', text: 'Local-only item', createdAt: 1 }]));
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');

    await renderPage();

    expect(authClientMocks.authFetch).toHaveBeenCalledWith('/api/library/generations?limit=50');
    expect(getItemSpy).not.toHaveBeenCalledWith('minimax_speech_history');
    expect(container!.textContent).toContain('No Library records yet.');
    expect(container!.textContent).not.toContain('Local-only item');
  });

  it('renders and downloads local_file audio through the backend asset endpoint', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const removeSpy = vi.spyOn(HTMLAnchorElement.prototype, 'remove').mockImplementation(() => undefined);
    generations = [createGeneration()];

    await renderPage();

    expect(container!.textContent).toContain('Hello from SQLite');
    expect(container!.textContent).toContain('Stored on server');
    expect(specValue(container!, 'Voice')).toBe('voice-a');

    const downloadButton = Array.from(container!.querySelectorAll('button')).find((button) => button.textContent === 'Download audio');
    act(() => {
      downloadButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(clickSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
  });

  it('filters backend records by kind', async () => {
    generations = [
      createGeneration(),
      createGeneration({
        id: 'generation-2',
        kind: 'music',
        source: 'text-to-music',
        prompt: 'Glossy synth-pop',
        model: 'music-3.0',
        metadata: { durationSeconds: 118, sampleRate: 44100, bitrate: 256000 },
        assets: [],
        createdAt: 2,
        updatedAt: 2,
      }),
    ];

    await renderPage();

    const musicFilter = Array.from(container!.querySelectorAll('button')).find((button) => button.textContent === 'Music');
    act(() => {
      musicFilter?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container!.textContent).toContain('Glossy synth-pop');
    expect(container!.textContent).not.toContain('Hello from SQLite');
  });

  it('renders cover preprocess records with cover generation action before expiry', async () => {
    generations = [createGeneration({
      id: 'cover-preprocess-1',
      kind: 'music',
      source: 'cover-preprocess',
      title: 'Cover preprocess',
      prompt: '[Verse]\nCity lights',
      model: 'music-cover',
      providerGenerationId: 'cover-feature-1',
      metadata: {
        coverFeatureId: 'cover-feature-1',
        formattedLyrics: '[Verse]\nCity lights',
        audioDurationSeconds: 42,
        expiresAt: Date.now() + 60_000,
      },
      assets: [],
    })];

    await renderPage();

    expect(container!.textContent).toContain('Cover preprocess');
    expect(specValue(container!, 'Source')).toBe('Cover Preprocess');
    expect(specValue(container!, 'Reference duration')).toBe('42s');
    expect(container!.textContent).toContain('Reference audio bytes were not saved.');
    expect(container!.textContent).toContain('Cover ID TTL');
    const action = Array.from(container!.querySelectorAll('a')).find((anchor) => anchor.textContent === 'Use in cover generation');
    const actionUrl = new URL(action?.getAttribute('href') ?? '', 'http://localhost');
    expect(actionUrl.pathname).toBe('/music');
    expect(actionUrl.searchParams.get('coverPreprocessId')).toBe('cover-preprocess-1');
    expect(actionUrl.searchParams.has('coverFeatureId')).toBe(false);
    expect(actionUrl.searchParams.has('lyrics')).toBe(false);
    expect(container!.textContent).not.toContain('Audio not stored');
  });

  it('marks an item whose audio was never stored, and offers no download for it', async () => {
    generations = [createGeneration({
      id: 'generation-without-audio',
      kind: 'tts',
      source: 'text-to-speech',
      prompt: 'A clip that never landed',
      metadata: {},
      assets: [],
    })];

    await renderPage();

    // The state is a badge, not a disabled button that looks like an action.
    expect(container!.textContent).toContain('Audio not stored');
    const badge = Array.from(container!.querySelectorAll('span')).find((span) => span.textContent === 'Audio not stored');
    expect(badge).toBeDefined();
    expect(
      Array.from(container!.querySelectorAll('button')).some((button) => button.textContent === 'Download audio'),
    ).toBe(false);
  });

  it('explains expired cover preprocess records without offering cover generation action', async () => {
    generations = [createGeneration({
      id: 'cover-preprocess-expired',
      kind: 'music',
      source: 'cover-preprocess',
      title: 'Cover preprocess',
      prompt: '[Verse]\nCity lights',
      metadata: {
        coverFeatureId: 'cover-feature-expired',
        formattedLyrics: '[Verse]\nCity lights',
        expiresAt: Date.now() - 1,
      },
      assets: [],
    })];

    await renderPage();

    expect(container!.textContent).toContain('Cover ID expired');
    expect(container!.textContent).toContain('This cover feature ID expired. Run Cover Preprocess again before using it for cover generation.');
    expect(container!.textContent).not.toContain('Use in cover generation');
  });

  it('deletes one backend generation only after confirmation', async () => {
    generations = [createGeneration()];

    await renderPage();

    const removeButton = Array.from(container!.querySelectorAll('button')).find((button) => button.textContent === 'Remove');
    act(() => {
      removeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container!.querySelector('[role="alertdialog"]')?.getAttribute('aria-label')).toBe('Remove library record?');
    expect(container!.textContent).toContain('Hello from SQLite');

    const confirmButton = Array.from(container!.querySelectorAll('[role="alertdialog"] button')).find((button) => button.textContent === 'Remove');
    await act(async () => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(authClientMocks.authFetch).toHaveBeenCalledWith('/api/library/generations/generation-1', { method: 'DELETE' });
    expect(container!.textContent).toContain('No Library records yet.');
  });

  it('clears backend records through the API', async () => {
    generations = [createGeneration(), createGeneration({ id: 'generation-2', prompt: 'Second record' })];

    await renderPage();

    const clearButton = Array.from(container!.querySelectorAll('button')).find((button) => button.textContent === 'Clear all');
    act(() => {
      clearButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const confirmButton = Array.from(container!.querySelectorAll('[role="alertdialog"] button')).find((button) => button.textContent === 'Clear all');
    await act(async () => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(authClientMocks.authFetch).toHaveBeenCalledWith('/api/library/generations/generation-1', { method: 'DELETE' });
    expect(authClientMocks.authFetch).toHaveBeenCalledWith('/api/library/generations/generation-2', { method: 'DELETE' });
    expect(container!.textContent).toContain('No Library records yet.');
  });
});
