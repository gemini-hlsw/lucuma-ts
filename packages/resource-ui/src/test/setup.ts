import { beforeEach } from 'vitest';

/**
 * Preferences outlive a component but must not outlive a test: each one starts with no habit.
 * The event is what tells a preference its session choice is stale - the same path another tab takes.
 */
beforeEach(() => {
  localStorage.clear();
  window.dispatchEvent(new StorageEvent('storage', { key: null }));
});
