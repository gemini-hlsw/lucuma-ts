import { MockLink } from '@apollo/client/testing';
import { beforeEach } from 'vitest';

// Apollo 4 mocks answer after 20-50 ms; a query re-issued inside that window finds its one-use mock spent.
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
