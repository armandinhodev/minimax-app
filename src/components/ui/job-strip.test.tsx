import React, { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { JobStrip } from './job-strip';

vi.mock('@chakra-ui/react', () => ({
  Box: ({ children, as: Component = 'div', ...props }: { children?: ReactNode; as?: keyof JSX.IntrinsicElements } & Record<string, unknown>) => {
    const visible = Object.fromEntries(
      Object.entries(props).filter(([key]) => key.startsWith('aria-') || key === 'role'),
    );
    return <Component {...visible}>{children}</Component>;
  },
}));

describe('JobStrip', () => {
  it('renders nothing when there is no job to describe', () => {
    expect(renderToStaticMarkup(<JobStrip />)).toBe('');
  });

  it('marks the stage the job is actually in', () => {
    const marks: Array<[Parameters<typeof JobStrip>[0]['state'], string]> = [
      ['queued', 'Dispatch'],
      ['running', 'Render'],
      ['succeeded', 'Retrieve'],
      ['failed', 'Render'],
    ];

    for (const [state, stage] of marks) {
      const html = renderToStaticMarkup(<JobStrip state={state} />);
      const afterCurrent = html.split('aria-current="step"')[1] ?? '';
      expect(afterCurrent.slice(0, 200), String(state)).toContain(stage);
    }
  });

  it('keeps the state readable next to the stages', () => {
    const html = renderToStaticMarkup(<JobStrip state="succeeded" detail="task-42" />);

    expect(html).toContain('Succeeded');
    expect(html).toContain('task-42');
  });
});
