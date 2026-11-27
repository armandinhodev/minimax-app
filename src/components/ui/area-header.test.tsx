import React, { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { AreaHeader } from './area-header';

vi.mock('@chakra-ui/react', () => ({
  Box: ({ children, as: Component = 'div', ...props }: { children?: ReactNode; as?: keyof JSX.IntrinsicElements } & Record<string, unknown>) => {
    void props;
    return <Component>{children}</Component>;
  },
}));

describe('AreaHeader', () => {
  it('carries the title, the description and the one constraint worth reading', () => {
    const html = renderToStaticMarkup(
      <AreaHeader
        title="Image generation"
        description="Compose a visual brief and inspect the resulting images."
        note="Provider URLs are time limited."
      />,
    );

    expect(html).toContain('<h1>Image generation</h1>');
    expect(html).toContain('Compose a visual brief and inspect the resulting images.');
    expect(html).toContain('Provider URLs are time limited.');
  });

  it('shows the live state and the actions of the area', () => {
    const html = renderToStaticMarkup(
      <AreaHeader
        title="Video generation"
        state="running"
        stateDetail="task-1"
        actions={<button type="button">Refresh tasks</button>}
      />,
    );

    expect(html).toContain('Running');
    expect(html).toContain('task-1');
    expect(html).toContain('Refresh tasks');
  });
});
