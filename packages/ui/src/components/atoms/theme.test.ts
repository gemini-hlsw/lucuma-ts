import type { Store } from 'jotai';
import { createStore } from 'jotai';

import { themeAtom } from './theme';

describe('themeAtom', () => {
  let store: Store;

  beforeEach(() => {
    store = createStore();
  });
  it('should have initial value dark', () => {
    expect(store.get(themeAtom)).toBe('dark');
  });

  it('should toggle the theme', () => {
    store.set(themeAtom);
    expect(store.get(themeAtom)).toBe('light');

    store.set(themeAtom);
    expect(store.get(themeAtom)).toBe('dark');
  });

  it('should be able to set the theme explicitly', () => {
    store.set(themeAtom, 'light');
    expect(store.get(themeAtom)).toBe('light');

    store.set(themeAtom, 'dark');
    expect(store.get(themeAtom)).toBe('dark');
  });
});
