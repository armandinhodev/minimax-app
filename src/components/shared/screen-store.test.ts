import { describe, expect, it, vi } from 'vitest';

import { ensureScreenValue, useScreenStore } from './screen-store';

describe('screen store', () => {
  it('keeps the first value and applies functional updates', () => {
    const store = useScreenStore.getState();

    ensureScreenValue('test:count', 0);
    store.setValue('test:count', (previous: unknown) => (previous as number) + 1);
    store.setValue('test:count', (previous: unknown) => (previous as number) + 1);

    expect(useScreenStore.getState().values['test:count']).toBe(2);
  });

  it('notifies subscribers and ignores an unchanged value', () => {
    const listener = vi.fn();
    const unsubscribe = useScreenStore.subscribe(listener);

    useScreenStore.getState().setValue('test:value', 1);
    expect(listener).toHaveBeenCalledTimes(1);

    useScreenStore.getState().setValue('test:value', 1);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('resets only the requested namespace', () => {
    const store = useScreenStore.getState();
    store.setValue('image:prompt', 'A photo');
    store.setValue('image:model', 'M3');
    store.setValue('chat:input', 'Hello');

    store.resetNamespace('image');

    const values = useScreenStore.getState().values;
    expect(values['image:prompt']).toBeUndefined();
    expect(values['image:model']).toBeUndefined();
    expect(values['chat:input']).toBe('Hello');
  });

  it('does not reset a namespace that only shares a prefix word', () => {
    const store = useScreenStore.getState();
    store.setValue('voices:filter', 'spanish');
    store.setValue('voices-clone:voiceId', 'voice-1');
    store.setValue('voice-design:prompt', 'Warm narrator');

    store.resetNamespace('voices');

    const values = useScreenStore.getState().values;
    expect(values['voices:filter']).toBeUndefined();
    expect(values['voices-clone:voiceId']).toBe('voice-1');
    expect(values['voice-design:prompt']).toBe('Warm narrator');
  });

  it('registers the initial value without notifying', () => {
    const listener = vi.fn();
    const unsubscribe = useScreenStore.subscribe(listener);

    ensureScreenValue('test:initial', 'first');
    ensureScreenValue('test:initial', 'second');

    expect(useScreenStore.getState().values['test:initial']).toBe('first');
    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('resets everything between test cases', () => {
    useScreenStore.getState().setValue('a:1', 1);
    useScreenStore.getState().resetAll();

    expect(useScreenStore.getState().values).toEqual({});
  });
});
