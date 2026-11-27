import React, { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MusicPage from './page';

const authClientMocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  parseApiError: vi.fn(),
}));

const audioStorageMocks = vi.hoisted(() => ({
  storeAudioFromHex: vi.fn(),
}));

const historyMocks = vi.hoisted(() => ({
  saveHistoryItem: vi.fn(),
}));

vi.mock('@/lib/auth-client', () => authClientMocks);
vi.mock('@/lib/audio-storage', () => audioStorageMocks);
vi.mock('@/lib/history', () => historyMocks);

vi.mock('@chakra-ui/react', () => ({
  Box: ({ children, as: Component = 'div', ...props }: { children?: ReactNode; as?: keyof JSX.IntrinsicElements } & Record<string, unknown>) => {
    void props;
    return <Component>{children}</Component>;
  },
}));

vi.mock('@/components/tts/AudioPlayer', () => ({
  AudioPlayer: ({ hex, format }: { hex: string; format?: string }) => <div>Audio preview {format}: {hex}</div>,
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

vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, options, disabled }: { value?: string; onValueChange?: (value: string) => void; options: Array<{ value: string; label: string }>; disabled?: boolean }) => (
    <select value={value} disabled={disabled} onChange={(event) => onValueChange?.(event.currentTarget.value)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  ),
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, disabled, onChange }: { checked?: boolean; disabled?: boolean; onChange?: (checked: boolean) => void }) => (
    <input
      aria-label="Instrumental mode"
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

describe('MusicPage', () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    window.history.replaceState(null, '', window.location.pathname || '/');
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

  it('generates vocal music and relies on Library recording', async () => {
    authClientMocks.authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'trace-1',
        audio: '00010203',
        format: 'mp3',
        metadata: { traceId: 'trace-1', durationSeconds: 118, sampleRate: 44100, bitrate: 256000 },
      }),
    });

    act(() => {
      root!.render(<MusicPage />);
    });

    const prompt = container!.querySelector('#music-prompt') as HTMLTextAreaElement;
    const lyrics = container!.querySelector('#music-lyrics') as HTMLTextAreaElement;

    act(() => {
      changeTextarea(prompt, 'Glossy synth-pop with a bright chorus.');
      changeTextarea(lyrics, '[Verse]\nCity lights\n[Chorus]\nRise again');
    });

    const generateButton = Array.from(container!.querySelectorAll('button')).find((button) => button.textContent === 'Generate music');
    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(authClientMocks.authFetch).toHaveBeenCalledWith('/api/minimax/music/generations', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'music-3.0',
        prompt: 'Glossy synth-pop with a bright chorus.',
        lyrics: '[Verse]\nCity lights\n[Chorus]\nRise again',
        instrumental: false,
        stream: false,
        outputFormat: 'hex',
        audioSetting: { sampleRate: 44100, bitrate: 256000, format: 'mp3' },
      }),
    }));
    expect(audioStorageMocks.storeAudioFromHex).not.toHaveBeenCalled();
    expect(historyMocks.saveHistoryItem).not.toHaveBeenCalled();
    expect(container!.textContent).toContain('Music generated and saved to Library');
    expect(container!.textContent).toContain('Audio preview mp3: 00010203');
  });

  it('generates instrumental music without lyrics', async () => {
    authClientMocks.authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'trace-2', audio: '00010203', format: 'mp3', metadata: {} }),
    });

    act(() => {
      root!.render(<MusicPage />);
    });

    const instrumentalToggle = container!.querySelector('input[type="checkbox"]') as HTMLInputElement;
    const prompt = container!.querySelector('#music-prompt') as HTMLTextAreaElement;

    act(() => {
      instrumentalToggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      changeTextarea(prompt, 'Instrumental cinematic piano with soft strings.');
    });

    const generateButton = Array.from(container!.querySelectorAll('button')).find((button) => button.textContent === 'Generate music');
    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(authClientMocks.authFetch).toHaveBeenCalledWith('/api/minimax/music/generations', expect.objectContaining({
      body: expect.stringContaining('"instrumental":true'),
    }));
    expect(JSON.parse(authClientMocks.authFetch.mock.calls[0][1].body)).toMatchObject({
      prompt: 'Instrumental cinematic piano with soft strings.',
      lyrics: '',
      instrumental: true,
    });
    expect(historyMocks.saveHistoryItem).not.toHaveBeenCalled();
  });

  it('prefills cover generation from URL params and submits coverFeatureId', async () => {
    const params = new URLSearchParams({
      coverFeatureId: 'cover-feature-1',
      lyrics: '[Verse]\nCity lights',
      style: 'Acoustic folk cover with warm vocals.',
    });
    window.history.replaceState(null, '', `${window.location.pathname || '/'}?${params.toString()}`);
    authClientMocks.authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'trace-cover', audio: '00010203', format: 'mp3', metadata: {} }),
    });

    act(() => {
      root!.render(<MusicPage />);
    });

    expect(container!.textContent).toContain('Cover generation requires a cover feature ID');
    expect(container!.textContent).toContain('expires 24 hours');
    const coverFeatureId = container!.querySelector('#cover-feature-id') as HTMLInputElement;
    const prompt = container!.querySelector('#music-prompt') as HTMLTextAreaElement;
    const lyrics = container!.querySelector('#music-lyrics') as HTMLTextAreaElement;
    expect(coverFeatureId.value).toBe('cover-feature-1');
    expect(prompt.value).toBe('Acoustic folk cover with warm vocals.');
    expect(lyrics.value).toBe('[Verse]\nCity lights');

    const generateButton = Array.from(container!.querySelectorAll('button')).find((button) => button.textContent === 'Generate cover');
    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(authClientMocks.authFetch).toHaveBeenCalledWith('/api/minimax/music/generations', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'music-cover',
        prompt: 'Acoustic folk cover with warm vocals.',
        lyrics: '[Verse]\nCity lights',
        instrumental: false,
        coverFeatureId: 'cover-feature-1',
        stream: false,
        outputFormat: 'hex',
        audioSetting: { sampleRate: 44100, bitrate: 256000, format: 'mp3' },
      }),
    }));
  });

  it('hydrates cover generation from coverPreprocessId via Library', async () => {
    const params = new URLSearchParams({
      coverPreprocessId: 'library-cover-preprocess-1',
      style: 'Acoustic folk cover with warm vocals.',
    });
    window.history.replaceState(null, '', `${window.location.pathname || '/'}?${params.toString()}`);
    authClientMocks.authFetch.mockImplementation(async (url: string) => {
      if (url === '/api/library/generations/library-cover-preprocess-1') {
        return Response.json({
          generation: {
            id: 'library-cover-preprocess-1',
            kind: 'music',
            source: 'cover-preprocess',
            status: 'completed',
            title: 'Cover preprocess',
            prompt: '[Verse]\nCity lights',
            model: 'music-cover',
            providerGenerationId: 'cover-feature-1',
            providerTaskId: null,
            providerFileId: null,
            metadata: {
              coverFeatureId: 'cover-feature-1',
              formattedLyrics: '[Verse]\nCity lights',
              expiresAt: Date.now() + 60_000,
            },
            assets: [],
            createdAt: 1,
            updatedAt: 1,
          },
        });
      }

      return Response.json({ id: 'trace-cover', audio: '00010203', format: 'mp3', metadata: {} });
    });

    await act(async () => {
      root!.render(<MusicPage />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(authClientMocks.authFetch).toHaveBeenCalledWith('/api/library/generations/library-cover-preprocess-1');
    expect(container!.textContent).toContain('Loaded Cover Preprocess record from Library');
    const coverFeatureId = container!.querySelector('#cover-feature-id') as HTMLInputElement;
    const prompt = container!.querySelector('#music-prompt') as HTMLTextAreaElement;
    const lyrics = container!.querySelector('#music-lyrics') as HTMLTextAreaElement;
    expect(coverFeatureId.value).toBe('cover-feature-1');
    expect(prompt.value).toBe('Acoustic folk cover with warm vocals.');
    expect(lyrics.value).toBe('[Verse]\nCity lights');

    const generateButton = Array.from(container!.querySelectorAll('button')).find((button) => button.textContent === 'Generate cover');
    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(authClientMocks.authFetch).toHaveBeenCalledWith('/api/minimax/music/generations', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'music-cover',
        prompt: 'Acoustic folk cover with warm vocals.',
        lyrics: '[Verse]\nCity lights',
        instrumental: false,
        coverFeatureId: 'cover-feature-1',
        stream: false,
        outputFormat: 'hex',
        audioSetting: { sampleRate: 44100, bitrate: 256000, format: 'mp3' },
      }),
    }));
  });

  it('does not offer the discontinued free music models and shows the availability notice', async () => {
    act(() => {
      root!.render(<MusicPage />);
    });

    const optionValues = Array.from(container!.querySelectorAll('option')).map((option) => option.value);
    expect(optionValues).toEqual(['music-3.0', 'music-cover']);
    expect(optionValues).not.toContain('music-3.0-free');
    expect(optionValues).not.toContain('music-cover-free');
    expect(container!.textContent).toContain('existing paying accounts');
  });

  it('blocks vocal generation until lyrics are provided', async () => {
    act(() => {
      root!.render(<MusicPage />);
    });

    expect(container!.textContent).toContain('Add lyrics before generating vocal music.');
    const generateButton = Array.from(container!.querySelectorAll('button')).find((button) => button.textContent === 'Generate music') as HTMLButtonElement;

    await act(async () => {
      generateButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(generateButton.disabled).toBe(true);
    expect(authClientMocks.authFetch).not.toHaveBeenCalled();
  });

  it('keeps generated preview visible without browser audio storage', async () => {
    authClientMocks.authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'trace-3', audio: '00010203', format: 'mp3', metadata: {} }),
    });

    act(() => {
      root!.render(<MusicPage />);
    });

    const lyrics = container!.querySelector('#music-lyrics') as HTMLTextAreaElement;
    act(() => {
      changeTextarea(lyrics, '[Chorus]\nRise again');
    });

    const generateButton = Array.from(container!.querySelectorAll('button')).find((button) => button.textContent === 'Generate music');
    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(audioStorageMocks.storeAudioFromHex).not.toHaveBeenCalled();
    expect(container!.textContent).toContain('Music generated and saved to Library');
    expect(container!.textContent).toContain('Audio preview mp3: 00010203');
    expect(historyMocks.saveHistoryItem).not.toHaveBeenCalled();
  });
});
