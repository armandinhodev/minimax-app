'use client';

import { useScreenStore } from '@/components/shared/screen-store';

const CACHE_KEY = 'media-reference-previews:files';
const MAX_BYTES = 64 * 1024 * 1024;
const MAX_FILES = 32;

type PreviewFiles = ReadonlyMap<string, File>;

export function rememberReferencePreview(reference: string, file: File): void {
  if (!file.size || file.size > MAX_BYTES) return;

  // Originals are kept in the tab's in-memory store, never persisted. The
  // shared store already clears on logout and survives client navigation.
  useScreenStore.getState().setValue(CACHE_KEY, (previous: unknown) => {
    const files = new Map(previous as PreviewFiles | undefined);
    files.delete(reference);
    files.set(reference, file);
    let bytes = [...files.values()].reduce((total, entry) => total + entry.size, 0);
    for (const [key, entry] of files) {
      if (files.size <= MAX_FILES && bytes <= MAX_BYTES) break;
      files.delete(key);
      bytes -= entry.size;
    }
    return files;
  });
}

export function useReferencePreviewFile(reference: string): File | undefined {
  return useScreenStore((state) => (state.values[CACHE_KEY] as PreviewFiles | undefined)?.get(reference));
}
