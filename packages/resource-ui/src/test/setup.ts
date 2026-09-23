import { beforeEach } from 'vitest';

import { odbTokenAtom, sessionCheckedAtom } from '@/components/atoms/auth';
import { store } from '@/components/atoms/store';

/**
 * Preferences outlive a component but must not outlive a test: each one starts with no habit.
 * The event is what tells a preference its session choice is stale - the same path another tab takes.
 */
beforeEach(() => {
  localStorage.clear();
  window.dispatchEvent(new StorageEvent('storage', { key: null }));
  store.set(odbTokenAtom, null);
  store.set(sessionCheckedAtom, false);
});
