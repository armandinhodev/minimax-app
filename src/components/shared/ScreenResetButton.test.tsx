import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useScreenStore } from '@/components/shared/screen-store';
import { ScreenResetButton } from '@/components/shared/ScreenResetButton';

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

describe('ScreenResetButton', () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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

  it('clears its namespace and the extra stores it owns', () => {
    const store = useScreenStore.getState();
    store.setValue('music:prompt', 'A track');
    store.setValue('music:result', { id: 'trace-1' });
    store.setValue('voice-upload:file', new File(['x'], 'sample.wav'));
    store.setValue('lyrics:lyrics', 'Other screen');

    act(() => {
      root!.render(<ScreenResetButton namespace="music" extraNamespaces={['voice-upload']} />);
    });
    act(() => {
      container!.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const values = useScreenStore.getState().values;
    expect(values['music:prompt']).toBeUndefined();
    expect(values['music:result']).toBeUndefined();
    expect(values['voice-upload:file']).toBeUndefined();
    expect(values['lyrics:lyrics']).toBe('Other screen');
  });

  it('uses a specific label and runs the cleanup callback', () => {
    const onReset = vi.fn();

    act(() => {
      root!.render(<ScreenResetButton namespace="library" label="Reset filters" onReset={onReset} />);
    });

    const button = container!.querySelector('button') as HTMLButtonElement;
    expect(button.textContent).toBe('Reset filters');

    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('does nothing while disabled', () => {
    const onReset = vi.fn();
    useScreenStore.getState().setValue('video-generation:prompt', 'A shot');

    act(() => {
      root!.render(<ScreenResetButton namespace="video-generation" disabled onReset={onReset} />);
    });
    act(() => {
      container!.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(useScreenStore.getState().values['video-generation:prompt']).toBe('A shot');
    expect(onReset).not.toHaveBeenCalled();
  });
});
