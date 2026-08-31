import { createStore } from 'jotai';

import { atomWithToggle } from './atomWithToggle';

describe(atomWithToggle, () => {
  it('should return an atom with the initial value', () => {
    const atom = atomWithToggle(true);
    const store = createStore();

    expect(store.get(atom)).true;
  });

  it('should toggle the value', () => {
    const atom = atomWithToggle(true);
    const store = createStore();

    store.set(atom);
    expect(store.get(atom)).false;

    store.set(atom);
    expect(store.get(atom)).true;
  });

  it('should set the value', () => {
    const atom = atomWithToggle(false);
    const store = createStore();

    store.set(atom, true);
    expect(store.get(atom)).true;
  });
});
