'use client';

/**
 * The screen store — one Zustand instance above the routes.
 *
 * Next unmounts a page on navigation; module state does not. Keys are namespaced
 * per screen (`image:prompt`, `chat:messages`), so resetting a screen is a
 * prefix filter and tests can clear everything between cases.
 */
import { create } from 'zustand';

interface ScreenStateStore {
  values: Record<string, unknown>;
  setValue: (key: string, next: unknown | ((previous: unknown) => unknown)) => void;
  resetNamespace: (namespace: string) => void;
  resetAll: () => void;
}

export const useScreenStore = create<ScreenStateStore>((set) => ({
  values: {},

  setValue: (key, next) =>
    set((state) => {
      const previous = state.values[key];
      const value = typeof next === 'function'
        ? (next as (previousValue: unknown) => unknown)(previous)
        : next;

      if (Object.is(value, previous)) return state;

      return { values: { ...state.values, [key]: value } };
    }),

  resetNamespace: (namespace) =>
    set((state) => {
      const prefix = namespace.endsWith(':') ? namespace : `${namespace}:`;
      return {
        values: Object.fromEntries(
          Object.entries(state.values).filter(([key]) => !key.startsWith(prefix)),
        ),
      };
    }),

  resetAll: () => set({ values: {} }),
}));

/** Register the initial value once, without notifying subscribers. */
export function ensureScreenValue<T>(key: string, initial: T | (() => T)): void {
  const state = useScreenStore.getState();
  if (key in state.values) return;

  state.values[key] = typeof initial === 'function' ? (initial as () => T)() : initial;
}
