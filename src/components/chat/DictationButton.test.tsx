import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DictationButton } from './DictationButton';

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

describe('DictationButton', () => {
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

  it('explains that dictation needs microphone support instead of failing silently', () => {
    const onError = vi.fn();

    act(() => {
      root!.render(<DictationButton onTranscript={vi.fn()} onError={onError} />);
    });

    const button = Array.from(container!.querySelectorAll('button')).find((item) => item.textContent?.includes('Dictate'));
    expect(button).toBeDefined();

    act(() => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onError).toHaveBeenCalledWith('Dictation needs microphone support in this browser.');
  });
});
