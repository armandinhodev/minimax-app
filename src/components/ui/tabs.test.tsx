import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

// Chakra's Box needs a provider; the primitive only needs a DOM element here.
vi.mock('@chakra-ui/react', () => ({
  Box: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

function Example() {
  return (
    <Tabs defaultValue="system">
      <TabsList>
        <TabsTrigger value="system">System voices</TabsTrigger>
        <TabsTrigger value="user">My voices</TabsTrigger>
      </TabsList>
      <TabsContent value="system">System voices list</TabsContent>
      <TabsContent value="user">User voices list</TabsContent>
    </Tabs>
  );
}

describe('Tabs', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

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

  it('exposes the tablist, the selected tab and the panel it controls', () => {
    const html = renderToStaticMarkup(<Example />);

    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-controls="panel-system"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('aria-labelledby="tab-system"');
    // The selected tab is the one Tab key reaches; the rest are arrow-only.
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('System voices list');
    expect(html).not.toContain('User voices list');
  });

  it('moves focus with the arrow keys, wraps, and activates on click', () => {
    act(() => {
      root!.render(<Example />);
    });

    const tabs = Array.from(container!.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    expect(tabs.map((tab) => tab.textContent)).toEqual(['System voices', 'My voices']);

    act(() => {
      tabs[0].focus();
      tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(document.activeElement).toBe(tabs[1]);

    // ArrowLeft from the first tab wraps to the last.
    act(() => {
      tabs[0].focus();
      tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    });
    expect(document.activeElement).toBe(tabs[1]);

    // Home and End jump to the edges of the tablist.
    act(() => {
      tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    });
    expect(document.activeElement).toBe(tabs[0]);

    act(() => {
      tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    });
    expect(document.activeElement).toBe(tabs[1]);

    act(() => {
      tabs[1].click();
    });
    expect(container!.textContent).toContain('User voices list');
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');
  });
});
