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

  function transport() {
    return container!.querySelector('nav[aria-label="Product areas"]') as HTMLElement;
  }

  function areaLinks() {
    return Array.from(transport().querySelectorAll('a')).map((link) => ({
      href: link.getAttribute('href'),
      text: link.textContent,
      active: link.getAttribute('data-active'),
    }));
  }

  function subnav() {
    return container!.querySelector('nav[aria-label$="routes"]') as HTMLElement | null;
  }

  function subnavLinks() {
    const nav = subnav();
    if (!nav) return [];
    return Array.from(nav.querySelectorAll('a')).map((link) => ({
      href: link.getAttribute('href'),
      text: link.textContent,
      current: link.getAttribute('aria-current'),
    }));
  }

  it('lists every area in the transport and marks the one in use', () => {
    navigationMocks.pathname = '/music/lyrics';
    renderLayout();

    const links = areaLinks();

    expect(links.map((link) => link.href)).toEqual([
      '/tts',
      '/asr',
      '/text',
      '/image',
      '/music',
      '/video',
      '/video-agent',
      '/library',
    ]);
    expect(links.find((link) => link.href === '/music')?.active).toBe('true');
    expect(links.filter((link) => link.active === 'true')).toHaveLength(1);
    expect(transport().querySelector('a[aria-current="page"]')).toBeNull();
  });

  it('shows only the routes of the active area in the subnav', () => {
    navigationMocks.pathname = '/music/lyrics';
    renderLayout();

    expect(subnav()?.getAttribute('aria-label')).toBe('Music routes');
    expect(subnavLinks().map((link) => link.href)).toEqual([
      '/music',
      '/music/lyrics',
      '/music/cover-preprocess',
    ]);
    expect(subnavLinks().filter((link) => link.current === 'page')).toEqual([
      expect.objectContaining({ href: '/music/lyrics' }),
    ]);
    expect(container!.textContent).toContain('Music creation suite');
  });

  it('marks the landing route current when the area opens on it', () => {
    navigationMocks.pathname = '/tts';
    renderLayout();

    expect(subnav()?.getAttribute('aria-label')).toBe('Speech routes');
    expect(subnavLinks().filter((link) => link.current === 'page')).toEqual([
      expect.objectContaining({ href: '/tts', text: 'Text to Speech' }),
    ]);
  });

  it('keeps Voices inactive when a voice tool route is active', () => {
    navigationMocks.pathname = '/voices/clone';
    renderLayout();

    expect(areaLinks().find((link) => link.href === '/tts')?.active).toBe('true');
    expect(subnavLinks().filter((link) => link.current === 'page')).toEqual([
      expect.objectContaining({ href: '/voices/clone', text: 'Clone Voice' }),
    ]);
  });

  it('exposes the video modes as routes of the video area', () => {
    navigationMocks.pathname = '/video/generation';
    renderLayout();

    expect(areaLinks().find((link) => link.href === '/video')?.active).toBe('true');
    expect(subnavLinks().map((link) => link.href)).toEqual([
      '/video/generation',
      '/video/context-ir',
      '/video/regeneration',
      '/video/tasks',
    ]);
    expect(subnavLinks().filter((link) => link.current === 'page')).toHaveLength(1);
  });

  it('drops the subnav for an area with a single route', () => {
    navigationMocks.pathname = '/library';
    renderLayout();

    expect(subnav()).toBeNull();
    expect(areaLinks().find((link) => link.href === '/library')?.active).toBe('true');
  });

  it('marks a different area when the route belongs to it', () => {
    navigationMocks.pathname = '/image/image-to-image';
    renderLayout();

    expect(areaLinks().find((link) => link.href === '/image')?.active).toBe('true');
    expect(subnavLinks().filter((link) => link.current === 'page')).toEqual([
      expect.objectContaining({ href: '/image/image-to-image', text: 'Image to Image' }),
    ]);
    expect(areaLinks().filter((link) => link.href === '/image' && link.active === 'true')).toHaveLength(1);
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
    expect(container!.querySelector('button[aria-label="Close navigation menu"]')).not.toBeNull();

    // The drawer takes focus while it is open...
    expect(dialog!.contains(document.activeElement)).toBe(true);
    expect(openButton.getAttribute('aria-expanded')).toBe('true');
    expect(openButton.getAttribute('aria-controls')).toBe(dialog?.id);

    // The drawer is the only place where every route is reachable at once.
    const drawerLinks = Array.from(dialog!.querySelectorAll('a')).map((link) => link.getAttribute('href'));
    expect(drawerLinks).toEqual(expect.arrayContaining(['/image/image-to-image', '/music/lyrics', '/video/tasks']));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(container!.querySelector('[role="dialog"]')).toBeNull();
    // ...and gives it back to the trigger when it closes.
    expect(document.activeElement).toBe(openButton);
    expect(openButton.getAttribute('aria-expanded')).toBe('false');
  });

  it('renders the page inside the workbench', () => {
    navigationMocks.pathname = '/tts';
    renderLayout();

    expect(container!.querySelector('main')?.textContent).toContain('Page content');
  });
});
