import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import VideoPage from './page';

const redirectMock = vi.hoisted(() => vi.fn((_url: string) => {
  // The real redirect interrupts the render by throwing.
  throw new Error('NEXT_REDIRECT');
}));

vi.mock('next/navigation', () => ({ redirect: redirectMock }));

describe('VideoPage', () => {
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

  it('sends the studio entry point to the primary mode', async () => {
    try {
      await act(async () => {
        root!.render(<VideoPage />);
      });
    } catch {
      // The redirect mock throws to interrupt the render, like the real one.
    }

    expect(redirectMock).toHaveBeenCalledWith('/video/generation');
  });
});
