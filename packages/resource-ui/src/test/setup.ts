import { MockLink } from '@apollo/client/testing';
import { beforeEach } from 'vitest';

import { MemoryStorage } from './memoryStorage';

// Test files run as same-origin iframes of one tab and so share its sessionStorage; `odbTokenAtom` snapshots that storage when its module loads, so a token another file holds at that moment would sign every fresh store in this file in.
Object.defineProperty(window, 'sessionStorage', { value: new MemoryStorage(), configurable: true });

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
