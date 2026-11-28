import { beforeEach, describe, expect, it } from 'vitest';

import { clearAppAccessKey, setAppAccessKey } from './AppKeyGate';
import { useScreenStore } from './screen-store';

describe('clearAppAccessKey', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('drops the access key and the compositions the tab was holding', () => {
    setAppAccessKey('secret');
    useScreenStore.getState().setValue('chat:input', 'draft');
    useScreenStore.getState().setValue('image:prompt', 'A photo');

    clearAppAccessKey();

    expect(sessionStorage.getItem('app_access_key')).toBeNull();
    const values = useScreenStore.getState().values;
    expect(values['chat:input']).toBeUndefined();
    expect(values['image:prompt']).toBeUndefined();
  });
});
