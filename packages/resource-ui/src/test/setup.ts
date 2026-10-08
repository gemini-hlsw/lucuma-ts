import { beforeEach } from 'vitest';

beforeEach(() => {
  localStorage.clear();
  // `odbTokenAtom` reads sessionStorage the first time a store touches it.
  sessionStorage.clear();
  // A mounted preference learns of the clear only from the event, the way it would from another tab.
  window.dispatchEvent(new StorageEvent('storage', { key: null }));
});
