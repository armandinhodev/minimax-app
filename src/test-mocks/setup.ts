import { beforeEach } from 'vitest';

import { useScreenStore } from '@/components/shared/screen-store';

/** Screen state lives above the routes in the app, so it is reset per test. */
beforeEach(() => {
  useScreenStore.getState().resetAll();
});
