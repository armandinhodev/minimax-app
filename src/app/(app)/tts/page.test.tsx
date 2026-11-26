import React, { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TTSPage from './page';

const authClientMocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  parseApiError: vi.fn(),
}));

const historyMocks = vi.hoisted(() => ({
  saveHistoryItem: vi.fn(),
}));

const audioStorageMocks = vi.hoisted(() => ({
  storeAudioFromHex: vi.fn(),
}));

vi.mock('@/lib/auth-client', () => authClientMocks);

vi.mock('@/lib/history', () => historyMocks);

vi.mock('@/lib/audio-storage', () => audioStorageMocks);

vi.mock('@chakra-ui/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@chakra-ui/react')>();
  return {
    ...actual,
    Box: ({ children }: { children?: ReactNode } & Record<string, unknown>) => <div>{children}</div>,
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { colorPalette?: string; loading?: boolean; size?: string; variant?: string }) => {
    const { children, colorPalette, loading, size, variant, ...buttonProps } = props;
    void colorPalette;
    void loading;
    void size;
    void variant;
    return <button {...buttonProps}>{children}</button>;
  },
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}));

vi.mock('@/components/ui/card', () => ({
  Sheet: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ onValueChange, options, value }: { onValueChange?: (value: string) => void; options: Array<{ value: string; label: string }>; value?: string }) => (
    <select value={value} onChange={(event) => onValueChange?.(event.currentTarget.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('@/components/shared/ErrorDisplay', () => ({
  ErrorDisplay: ({ message }: { message?: string | null }) => <div>{message}</div>,
}));

vi.mock('@/components/tts/TextInput', () => ({
  TextInput: ({ disabled, id, label, onChange, value }: { disabled?: boolean; id: string; label: string; onChange: (value: string) => void; value: string }) => (
    <div>
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        aria-label={label}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </div>
  ),
}));

vi.mock('@/components/tts/VoiceSelector', () => ({
  VoiceSelector: ({ disabled, label, onChange, value }: { disabled?: boolean; label: string; onChange: (value: string) => void; value: string }) => (
    <label>
      {label}
      <select
        aria-label={label}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        <option value="">Select voice</option>
        <option value="voice-a">Voice A</option>
      </select>
    </label>
  ),
}));

vi.mock('@/components/tts/AudioPlayer', () => ({
  AudioPlayer: () => <div data-audio-player />,
}));

vi.mock('@/components/tts/StreamingPlayer', () => ({
  StreamingPlayer: ({ enabled, text, voiceId }: { enabled: boolean; text: string; voiceId: string }) => (
    <div data-streaming-player data-enabled={String(enabled)} data-text={text} data-voice-id={voiceId} />
  ),
}));

function changeTextarea(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function changeSelect(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('TTSPage', () => {
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

  it('keeps Generate Audio text separate from Streaming TTS text', () => {
    act(() => {
      root!.render(<TTSPage />);
    });

    const streamingToggle = Array.from(container!.querySelectorAll('button')).find((button) => button.textContent === 'Off');
    act(() => {
      streamingToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const generateText = container!.querySelector('#tts-text') as HTMLTextAreaElement | null;
    const streamingText = container!.querySelector('#stream-text') as HTMLTextAreaElement | null;

    expect(generateText).not.toBeNull();
    expect(streamingText).not.toBeNull();

    act(() => {
      generateText!.value = 'Generate only';
      generateText!.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(generateText!.value).toBe('Generate only');
    expect(streamingText!.value).toBe('');
    expect(container!.querySelector('[data-streaming-player]')?.getAttribute('data-text')).toBe('');
  });

  it('previews generated hex audio and relies on backend Library recording', async () => {
    authClientMocks.authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ audio: '00010203' }),
    });

    act(() => {
      root!.render(<TTSPage />);
    });

    const textArea = container!.querySelector('#tts-text') as HTMLTextAreaElement;
    const voiceSelect = Array.from(container!.querySelectorAll('select')).find((select) => select.getAttribute('aria-label') === 'Voice') as HTMLSelectElement;
    const generateButton = Array.from(container!.querySelectorAll('button')).find((button) => button.textContent === 'Generate');

    act(() => {
      changeTextarea(textArea, 'Hello from MiniMax');
      changeSelect(voiceSelect, 'voice-a');
    });
    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(audioStorageMocks.storeAudioFromHex).not.toHaveBeenCalled();
    expect(historyMocks.saveHistoryItem).not.toHaveBeenCalled();
    expect(container!.textContent).toContain('Audio generated and saved to backend Library');
    expect(container!.querySelector('[data-audio-player]')).not.toBeNull();
  });

  it('does not depend on browser audio storage for generated previews', async () => {
    authClientMocks.authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ audio: '00010203' }),
    });

    act(() => {
      root!.render(<TTSPage />);
    });

    const textArea = container!.querySelector('#tts-text') as HTMLTextAreaElement;
    const voiceSelect = Array.from(container!.querySelectorAll('select')).find((select) => select.getAttribute('aria-label') === 'Voice') as HTMLSelectElement;
    const generateButton = Array.from(container!.querySelectorAll('button')).find((button) => button.textContent === 'Generate');

    act(() => {
      changeTextarea(textArea, 'Hello from MiniMax');
      changeSelect(voiceSelect, 'voice-a');
    });
    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(audioStorageMocks.storeAudioFromHex).not.toHaveBeenCalled();
    expect(historyMocks.saveHistoryItem).not.toHaveBeenCalled();
    expect(container!.querySelector('[data-audio-player]')).not.toBeNull();
  });

  it('previews audioUrl responses without writing browser history', async () => {
    authClientMocks.authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ audioUrl: 'https://example.com/audio.mp3' }),
    });

    act(() => {
      root!.render(<TTSPage />);
    });

    const textArea = container!.querySelector('#tts-text') as HTMLTextAreaElement;
    const voiceSelect = Array.from(container!.querySelectorAll('select')).find((select) => select.getAttribute('aria-label') === 'Voice') as HTMLSelectElement;
    const generateButton = Array.from(container!.querySelectorAll('button')).find((button) => button.textContent === 'Generate');

    act(() => {
      changeTextarea(textArea, 'Hello from MiniMax');
      changeSelect(voiceSelect, 'voice-a');
    });
    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(audioStorageMocks.storeAudioFromHex).not.toHaveBeenCalled();
    expect(historyMocks.saveHistoryItem).not.toHaveBeenCalled();
    expect(container!.textContent).toContain('Audio generated and saved to backend Library');
  });
});
