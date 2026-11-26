/**
 * Shared mocks and helpers for the Video Studio tests.
 *
 * They live here so every test file uses the same stubs instead of copying
 * them: the vi.mock factories call these at call time, which keeps them
 * safe from vitest's hoisting.
 */

import type { ReactNode } from 'react';
import type { Mock } from 'vitest';

export function createChakraMock() {
  return {
    Box: ({ children, as: Component = 'div', ...props }: { children?: ReactNode; as?: keyof JSX.IntrinsicElements } & Record<string, unknown>) => {
      void props;
      return <Component>{children}</Component>;
    },
  };
}

export function createCardMock() {
  return {
    Sheet: ({ children, accent, size, ...props }: { children?: ReactNode; accent?: string; size?: string } & Record<string, unknown>) => {
      void accent;
      void size;
      return <section {...props}>{children}</section>;
    },
    SheetHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    SheetTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
    SheetDescription: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
    SheetContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  };
}

export function createButtonMock() {
  return {
    Button: ({ children, colorPalette, size, variant, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { colorPalette?: string; size?: string; variant?: string }) => {
      void colorPalette;
      void size;
      void variant;
      return <button {...props}>{children}</button>;
    },
  };
}

export function createInputMock() {
  return {
    Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  };
}

export function createLabelMock() {
  return {
    Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
  };
}

export function createSelectMock() {
  return {
    Select: ({ value, onValueChange, options, disabled, id }: { value?: string; onValueChange?: (value: string) => void; options: Array<{ value: string; label: string }>; disabled?: boolean; id?: string }) => (
      <select value={value} disabled={disabled} id={id} onChange={(event) => onValueChange?.(event.currentTarget.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    ),
  };
}

export function createTextareaMock() {
  return {
    Textarea: ({ minH, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { minH?: string }) => {
      void minH;
      return <textarea {...props} />;
    },
  };
}

export function createErrorDisplayMock() {
  return {
    ErrorDisplay: ({ message }: { message?: string | null }) => <div>{message}</div>,
  };
}

export function createLinkMock() {
  return {
    default: ({ children, href, onClick, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode; href: string }) => <a href={href} onClick={onClick} {...props}>{children}</a>,
  };
}

export function changeTextarea(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

export function changeInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

export function changeSelect(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

export function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === label);
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

export function queryCalls(authFetch: Mock, url: string) {
  return authFetch.mock.calls.filter((call) => call[0] === url);
}
