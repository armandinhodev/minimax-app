import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Markdown } from './Markdown';

describe('Markdown', () => {
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

  it('renders the Markdown MiniMax returns instead of showing its syntax', () => {
    act(() => {
      root!.render(
        <Markdown
          content={'## Result\n\n- **Bold** item\n- Second item\n\n```js\nconst answer = 42;\n```\n\n[Guide](https://example.com)'}
        />,
      );
    });

    expect(container!.querySelector('h2')?.textContent).toBe('Result');
    expect(container!.querySelectorAll('li')).toHaveLength(2);
    expect(container!.querySelector('strong')?.textContent).toBe('Bold');
    expect(container!.querySelector('pre code')?.textContent).toContain('const answer = 42;');
    expect(container!.querySelector('a')?.getAttribute('target')).toBe('_blank');
    expect(container!.textContent).not.toContain('- **');
  });

  it('renders GFM tables', () => {
    act(() => {
      root!.render(<Markdown content={'| Key | Value |\n| --- | --- |\n| Model | M3 |'} />);
    });

    expect(container!.querySelector('table')).not.toBeNull();
    expect(container!.querySelectorAll('td')).toHaveLength(2);
  });

  it('does not execute raw HTML', () => {
    act(() => {
      root!.render(<Markdown content={'Hello <script>alert(1)</script>'} />);
    });

    expect(container!.querySelector('script')).toBeNull();
    expect(container!.textContent).toContain('<script>');
  });
});
