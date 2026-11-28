import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetScreen, useScreenState } from './screen-state';

function Counter({ name }: { name: string }) {
  const [count, setCount] = useScreenState('test:counter', 0);
  return (
    <button type="button" onClick={() => setCount((current) => current + 1)}>
      {name}:{count}
    </button>
  );
}

describe('useScreenState', () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    resetScreen('test');
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

  it('shares a key between mounted components', () => {
    act(() => {
      root!.render(
        <>
          <Counter name="a" />
          <Counter name="b" />
        </>,
      );
    });

    const first = container!.querySelector('button') as HTMLButtonElement;
    act(() => {
      first.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const buttons = Array.from(container!.querySelectorAll('button')).map((button) => button.textContent);
    expect(buttons).toEqual(['a:1', 'b:1']);
  });

  it('keeps the value when the page unmounts and mounts again', () => {
    act(() => {
      root!.render(<Counter name="a" />);
    });

    act(() => {
      container!.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    act(() => {
      root!.render(<span>Other page</span>);
    });

    act(() => {
      root!.render(<Counter name="a" />);
    });

    expect(container!.querySelector('button')?.textContent).toBe('a:1');
  });

  it('resets a namespace back to its initial value', () => {
    act(() => {
      root!.render(<Counter name="a" />);
    });

    act(() => {
      container!.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    act(() => {
      resetScreen('test');
    });

    expect(container!.querySelector('button')?.textContent).toBe('a:0');
  });
});
