'use client';

/**
 * useScreenState — a useState that survives navigation.
 *
 * Backed by the Zustand screen store at module scope, so the value is still
 * there when the page mounts again. It accepts the same initial value or lazy
 * initializer as useState.
 */

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { useStore } from 'zustand';

import { ensureScreenValue, useScreenStore } from './screen-store';

export function useScreenState<T>(
  key: string,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  ensureScreenValue(key, initial);

  const value = useStore(useScreenStore, (state) => state.values[key] as T);
  const setValue = useCallback(
    (next: SetStateAction<T>) => {
      useScreenStore.getState().setValue(key, next);
    },
    [key],
  );

  return [value, setValue];
}

/** Clear every value of a screen namespace. */
export function resetScreen(namespace: string): void {
  useScreenStore.getState().resetNamespace(namespace);
}
