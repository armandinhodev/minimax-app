import React, { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { Plate } from './plate';

vi.mock('@chakra-ui/react', () => ({
  Box: ({ children, as: Component = 'div', ...props }: { children?: ReactNode; as?: keyof JSX.IntrinsicElements } & Record<string, unknown>) => {
    void props;
    return <Component>{children}</Component>;
  },
}));

describe('Plate', () => {
  it('frames the artifact and binds every caption slot to its label', () => {
    const html = renderToStaticMarkup(
      <Plate
        title="Results"
        description="Two images returned."
        caption={[
          { label: 'Model', value: 'MiniMax-H3-Image' },
          { label: 'Duration', value: '8s' },
        ]}
      >
        <img src="https://cdn.example.com/one.png" alt="Generated frame" />
      </Plate>,
    );

    expect(html).toContain('Results');
    expect(html).toContain('Two images returned.');
    expect(html).toContain('cdn.example.com/one.png');
    expect(html).toContain('Model');
    expect(html).toContain('MiniMax-H3-Image');
    expect(html).toContain('Duration');
    expect(html).toContain('8s');
  });

  it('invites the next action when there is no result yet', () => {
    const html = renderToStaticMarkup(
      <Plate title="Results" empty="Start with a clear prompt." />,
    );

    expect(html).toContain('Start with a clear prompt.');
  });
});
