import { MockLink } from '@apollo/client/testing';
import { beforeEach } from 'vitest';

// Apollo's default is a random 20-50 ms delay; a mock that answers late can be unsubscribed by the next interaction and is then spent.
MockLink.defaultOptions = { delay: 0 };

/**
 * Preferences outlive a component but must not outlive a test: each one starts with no habit.
 * The event is what tells a preference its session choice is stale - the same path another tab takes.
 */
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.dispatchEvent(new StorageEvent('storage', { key: null }));
});
