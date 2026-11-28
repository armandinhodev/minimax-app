import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaReferenceField } from './MediaReferenceField';

vi.mock('@chakra-ui/react', () => ({
  Box: ({ children, as: Component = 'div', role, 'aria-label': ariaLabel, ...props }: {
    children?: React.ReactNode;
    as?: keyof JSX.IntrinsicElements;
    role?: string;
    'aria-label'?: string;
  } & Record<string, unknown>) => {
    void props;
    return <Component role={role} aria-label={ariaLabel}>{children}</Component>;
  },
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, variant, size, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => {
    void variant;
    void size;
    return <button {...props}>{children}</button>;
  },
}));

vi.mock('@/components/ui/icons', () => ({
  Icon: () => null,
}));

vi.mock('./MediaReferenceActions', () => ({
  MediaReferenceActions: ({ method, onUse }: {
    method: 'paste' | 'upload';
    onUse: (value: { reference: string; fileName: string; size: number | null }) => void;
  }) => (
    <button
      type="button"
      onClick={() => onUse({ reference: 'mm_file://9', fileName: 'picked.png', size: 2048 })}
    >
      {method === 'upload' ? 'Upload image' : 'Paste image'}
    </button>
  ),
}));

function Harness({
  initial = '',
  multiple = false,
  maxItems,
  onError,
  disabled,
}: {
  initial?: string;
  multiple?: boolean;
  maxItems?: number;
  onError?: (message: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = React.useState(initial);

  return (
    <>
      <MediaReferenceField
        id="reference"
        purpose="video_generation_input"
        label="reference image"
        value={value}
        onChange={setValue}
        multiple={multiple}
        maxItems={maxItems}
        disabled={disabled}
        hint="Up to 9 images."
        onMediaError={onError}
      />
      <output data-testid="value">{value}</output>
    </>
  );
}

function findChip(container: HTMLElement, label: string): HTMLButtonElement {
  const chip = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === label);
  if (!chip) throw new Error(`Chip not found: ${label}`);
  return chip as HTMLButtonElement;
}

function valueOf(container: HTMLElement): string {
  return container.querySelector('[data-testid="value"]')?.textContent ?? '';
}

describe('MediaReferenceField', () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;
  const fetchPreview = vi.fn();

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.resetAllMocks();
    vi.stubGlobal('fetch', fetchPreview);
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
    vi.unstubAllGlobals();
  });

  it('shows one thumbnail per URL or inline image without using the MiniMax API', () => {
    const inline = 'data:image/png;base64,aQ==';
    const url = 'https://cdn.example.com/reference.png';
    act(() => root!.render(<Harness initial={`${url}, ${inline}`} multiple />));

    expect(findChip(container!, 'URL').getAttribute('aria-pressed')).toBe('true');
    const previews = [...container!.querySelectorAll('img')];
    expect(previews.map((image) => image.getAttribute('src'))).toEqual([url, inline]);
    expect(previews.map((image) => [image.width, image.height])).toEqual([[128, 128], [128, 128]]);
    expect(previews[0].getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(container!.textContent).toContain('Inline image');
    expect(fetchPreview).not.toHaveBeenCalled();
  });

  it('keeps the reference removable when a thumbnail fails to load', () => {
    const url = 'https://cdn.example.com/missing.png';
    act(() => root!.render(<Harness initial={url} />));

    const preview = container!.querySelector('img');
    expect(preview).not.toBeNull();
    act(() => preview!.dispatchEvent(new Event('error')));
    expect(container!.textContent).toContain('Preview unavailable');
    expect(valueOf(container!)).toBe(url);
    const remove = container!.querySelector<HTMLButtonElement>('[aria-label="Remove reference image"]');
    act(() => remove!.click());
    expect(valueOf(container!)).toBe('');
    expect(container!.textContent).not.toContain('Preview unavailable');
  });

  it.each([
    'data:text/html,hello',
    'https://user:secret@cdn.example.com/image.png',
    'javascript:alert(1)',
    'file:///image.png',
    'blob:https://cdn.example.com/image',
    'https://%',
    'mm_file://../99',
  ])('does not load an unsafe URL as an image: %s', (initial) => {
    act(() => root!.render(<Harness initial={initial} />));
    expect(container!.querySelector('img')).toBeNull();
    expect(container!.textContent).toContain('Preview unavailable');
    expect(fetchPreview).not.toHaveBeenCalled();
  });

  it('does not remove the reference while the field is disabled', () => {
    const url = 'https://cdn.example.com/reference.png';
    act(() => root!.render(<Harness initial={url} disabled />));
    const remove = container!.querySelector<HTMLButtonElement>('[aria-label="Remove reference image"]')!;
    expect(remove.disabled).toBe(true);
    act(() => remove.click());
    expect(valueOf(container!)).toBe(url);
  });

  it('starts in URL mode and reports what the user types', () => {
    act(() => {
      root!.render(<Harness />);
    });

    const input = container!.querySelector('#reference') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      setter?.call(input, 'https://cdn.example.com/photo.png');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(valueOf(container!)).toBe('https://cdn.example.com/photo.png');
    expect(container!.textContent).not.toContain('Upload image');
    expect(container!.textContent).not.toContain('From MiniMax');
  });

  it('offers no MiniMax library method and keeps a stored mm_file reference removable', () => {
    act(() => {
      root!.render(<Harness initial="mm_file://9" />);
    });

    const group = container!.querySelector('[role="group"]') as HTMLElement;
    const methods = Array.from(group.querySelectorAll('button')).map((button) => button.textContent);
    expect(methods).toEqual(['URL', 'Paste image', 'Upload']);
    expect(container!.textContent).not.toContain('From MiniMax');
    expect(container!.textContent).not.toContain('Choose');
    expect(container!.textContent).toContain('MiniMax file 9');
    expect(container!.textContent).toContain('No local preview');

    act(() => {
      container!.querySelector<HTMLButtonElement>('[aria-label="Remove reference image"]')!.click();
    });
    expect(valueOf(container!)).toBe('');
  });

  it('shows only the control of the chosen method', () => {
    act(() => {
      root!.render(<Harness />);
    });

    act(() => {
      findChip(container!, 'Upload').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container!.querySelector('#reference')).toBeNull();
    expect(container!.textContent).toContain('Upload image');

    act(() => {
      findChip(container!, 'Paste image').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container!.textContent).toContain('Paste image');
    expect(container!.textContent).not.toContain('Upload image');
  });

  it('takes the uploaded reference, shows it and lets the user remove it', () => {
    act(() => {
      root!.render(<Harness />);
    });
    act(() => {
      findChip(container!, 'Upload').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    act(() => {
      findChip(container!, 'Upload image').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(valueOf(container!)).toBe('mm_file://9');
    expect(container!.textContent).toContain('MiniMax file 9');

    const remove = Array.from(container!.querySelectorAll('button')).find(
      (button) => button.getAttribute('aria-label') === 'Remove reference image',
    );
    act(() => {
      remove?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(valueOf(container!)).toBe('');
  });

  it('appends in a multi-reference field', () => {
    act(() => {
      root!.render(<Harness initial="mm_file://1" multiple maxItems={2} />);
    });
    act(() => {
      findChip(container!, 'Upload').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    act(() => {
      findChip(container!, 'Upload image').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(valueOf(container!)).toBe('mm_file://1, mm_file://9');
    expect(container!.textContent).toContain('1. MiniMax file 1');
    expect(container!.textContent).toContain('2. MiniMax file 9');
  });

  it('stops at the limit and reports it', () => {
    const onError = vi.fn();

    act(() => {
      root!.render(<Harness initial="mm_file://1" multiple maxItems={1} onError={onError} />);
    });
    act(() => {
      findChip(container!, 'Upload').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    act(() => {
      findChip(container!, 'Upload image').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onError).toHaveBeenCalledWith('You can attach at most 1 images.');
    expect(valueOf(container!)).toBe('mm_file://1');
  });
});
