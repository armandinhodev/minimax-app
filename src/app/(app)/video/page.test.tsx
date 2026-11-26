import React, { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import VideoPage from './page';

vi.mock('@chakra-ui/react', () => ({
  Box: ({ children, as: Component = 'div', ...props }: { children?: ReactNode; as?: keyof JSX.IntrinsicElements } & Record<string, unknown>) => {
    void props;
    return <Component>{children}</Component>;
  },
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, accent, size, ...props }: { children?: ReactNode; accent?: string; size?: string } & Record<string, unknown>) => {
    void accent;
    void size;
    return <section {...props}>{children}</section>;
  },
  CardHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
  CardDescription: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  CardContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('next/link', () => ({
  default: ({ children, href, onClick, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode; href: string }) => <a href={href} onClick={onClick} {...props}>{children}</a>,
}));

describe('VideoPage', () => {
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
    root = null;
    container = null;
  });

  it('links each workflow to its own route', async () => {
    await act(async () => {
      root!.render(<VideoPage />);
    });

    const hrefs = Array.from(container!.querySelectorAll('a')).map((link) => link.getAttribute('href'));

    expect(hrefs).toEqual([
      '/video/generation',
      '/video/context-ir',
      '/video/regeneration',
      '/video/tasks',
    ]);
  });

  it('names every workflow', async () => {
    await act(async () => {
      root!.render(<VideoPage />);
    });

    const text = container!.textContent ?? '';

    expect(text).toContain('Video Generation');
    expect(text).toContain('H3-Context-IR');
    expect(text).toContain('2K Regeneration');
    expect(text).toContain('Tasks');
  });
});
