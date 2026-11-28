import React, { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppLayout from './layout';

const navigationMocks = vi.hoisted(() => ({
  pathname: '/music/lyrics',
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navigationMocks.pathname,
}));

vi.mock('next/link', () => ({
  default: ({ children, href, onClick, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode; href: string }) => <a href={href} onClick={onClick} {...props}>{children}</a>,
}));

vi.mock('@chakra-ui/react', () => ({
  Box: ({ children, as: Component = 'div', asChild, ...props }: { children?: ReactNode; as?: keyof JSX.IntrinsicElements; asChild?: boolean } & Record<string, unknown>) => {
    void props;
    if (asChild && React.isValidElement(children)) return children;
    return <Component>{children}</Component>;
  },
}));

vi.mock('@/components/shared/AppKeyGate', () => ({
  AppKeyGate: ({ children }: { children: ReactNode }) => <>{children}</>,
  clearAppAccessKey: vi.fn(),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, variant, size, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => {
    void variant;
    void size;
    return <button {...props}>{children}</button>;
  },
}));

describe('AppLayout navigation', () => {
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

  function renderLayout() {
    act(() => {
      root!.render(<AppLayout><main>Page content</main></AppLayout>);
    });
  }

  function nav() {
    return container!.querySelector('nav[aria-label="Product areas"]') as HTMLElement;
  }

  function links(scope: HTMLElement = nav()) {
    return Array.from(scope.querySelectorAll('a')).map((link) => ({
      href: link.getAttribute('href'),
      text: link.textContent,
      current: link.getAttribute('aria-current'),
      active: link.getAttribute('data-active'),
    }));
  }

  it('renders the overview and the eight areas, with the active area expanded', () => {
    navigationMocks.pathname = '/music/lyrics';
    renderLayout();

    const hrefs = links().map((link) => link.href);
    expect(hrefs).toEqual(expect.arrayContaining([
      '/',
      '/tts',
      '/text',
      '/image',
      '/music',
      '/video',
      '/video-agent',
      '/library',
      '/music/lyrics',
    ]));

    // Only the active area shows its routes.
    expect(hrefs).toContain('/music/cover-preprocess');
    expect(hrefs).not.toContain('/asr');
    expect(hrefs).not.toContain('/video/tasks');
    expect(hrefs).not.toContain('/image/image-to-image');

    expect(container!.querySelector('a[href="/music"]')?.getAttribute('data-active')).toBe('true');
    expect(container!.querySelector('a[href="/image"]')?.getAttribute('data-active')).toBe('false');
  });

  it('marks the current route with aria-current and keeps the area as context', () => {
    navigationMocks.pathname = '/music/lyrics';
    renderLayout();

    const current = links().filter((link) => link.current === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]).toEqual(expect.objectContaining({ href: '/music/lyrics', text: 'Lyrics' }));
  });

  it('groups transcription under speech and keeps it current', () => {
    navigationMocks.pathname = '/asr';
    renderLayout();

    expect(container!.querySelector('a[href="/tts"]')?.getAttribute('data-active')).toBe('true');
    expect(links().filter((link) => link.current === 'page')).toEqual([
      expect.objectContaining({ href: '/asr', text: expect.stringContaining('Transcription') }),
    ]);
    expect(links().map((link) => link.href)).toEqual(expect.arrayContaining(['/tts', '/asr', '/voices', '/voices/clone', '/voices/design']));
  });

  it('marks the area itself when it has a single route', () => {
    navigationMocks.pathname = '/library';
    renderLayout();

    const library = container!.querySelector('a[href="/library"]');
    expect(library?.getAttribute('aria-current')).toBe('page');
    expect(links().filter((link) => link.current === 'page')).toHaveLength(1);
  });

  it('shows the video routes when the video area is in use', () => {
    navigationMocks.pathname = '/video/generation';
    renderLayout();

    const hrefs = links().map((link) => link.href);
    expect(hrefs).toEqual(expect.arrayContaining([
      '/video/generation',
      '/video/context-ir',
      '/video/regeneration',
      '/video/tasks',
    ]));
    expect(links().filter((link) => link.current === 'page')).toHaveLength(1);
  });

  it('opens and closes the mobile drawer accessibly', () => {
    navigationMocks.pathname = '/tts';
    renderLayout();

    const openButton = container!.querySelector('button[aria-label="Open navigation menu"]') as HTMLButtonElement;
    expect(openButton).not.toBeNull();
    expect(container!.querySelector('[role="dialog"]')).toBeNull();

    act(() => {
      openButton.focus();
      openButton.click();
    });

    const dialog = container!.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-label')).toBe('Main navigation');
    expect(dialog!.contains(document.activeElement)).toBe(true);

    const drawerLinks = links(dialog as HTMLElement).map((link) => link.href);
    expect(drawerLinks).toEqual(expect.arrayContaining(['/voices/clone', '/voices/design', '/tts']));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(container!.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(openButton);
  });

  it('renders the page inside the workbench', () => {
    navigationMocks.pathname = '/tts';
    renderLayout();

    expect(container!.querySelector('main')?.textContent).toContain('Page content');
  });
});
