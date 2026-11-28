import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Dialog, DialogContent } from './dialog';

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/icons', () => ({
  Icon: () => null,
}));

describe('Dialog', () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;
  let outside: HTMLButtonElement | null = null;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    outside = document.createElement('button');
    outside.type = 'button';
    outside.textContent = 'Trigger';
    document.body.appendChild(outside);
    outside.focus();
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    outside?.remove();
    container = null;
    root = null;
    outside = null;
  });

  function renderDialog(onClose: () => void) {
    act(() => {
      root!.render(
        <Dialog open onOpenChange={() => undefined}>
          <DialogContent label="MiniMax files" onClose={onClose}>
            <button type="button">Use</button>
          </DialogContent>
        </Dialog>,
      );
    });

    const dialog = container!.querySelector('[role="dialog"]') as HTMLDivElement;
    if (!dialog) throw new Error('dialog not rendered');
    return dialog;
  }

  it('exposes a modal dialog and moves focus inside', () => {
    const dialog = renderDialog(vi.fn());

    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('MiniMax files');
    expect(document.activeElement?.textContent).toBe('Use');
  });

  it('wraps Tab inside the dialog', () => {
    const dialog = renderDialog(vi.fn());
    const buttons = Array.from(dialog.querySelectorAll('button'));
    const close = buttons[buttons.length - 1];

    act(() => {
      close.focus();
    });
    expect(document.activeElement).toBe(close);

    act(() => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    });

    expect(document.activeElement).toBe(buttons[0]);
  });

  it('closes with Escape and restores focus to the trigger', () => {
    const onClose = vi.fn();
    const dialog = renderDialog(onClose);

    act(() => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => {
      root!.unmount();
    });
    root = null;

    expect(document.activeElement).toBe(outside);
  });
});
