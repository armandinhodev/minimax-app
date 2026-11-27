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
        title="Image Generation"
        description="Create polished visual assets."
        note="Provider URLs are not guaranteed to stay available."
      />,
    );

    expect(html).toContain('<h1>Image Generation</h1>');
    expect(html).toContain('Create polished visual assets.');
    expect(html).toContain('Provider URLs are not guaranteed to stay available.');
  });

  it('shows the live state, the labelled readouts and the actions of the area', () => {
    const html = renderToStaticMarkup(
      <AreaHeader
        title="Video Generation"
        state="running"
        stateDetail="task-1"
        readoutsLabel="Request"
        readouts={[
          { label: 'Model', value: 'MiniMax-H3' },
          { label: 'Duration', value: '5s' },
        ]}
        actions={<button type="button">Refresh tasks</button>}
      />,
    );

    expect(html).toContain('Running');
    expect(html).toContain('task-1');
    expect(html).toContain('Request');
    expect(html).toContain('Model');
    expect(html).toContain('MiniMax-H3');
    expect(html).toContain('Refresh tasks');
  });
});
