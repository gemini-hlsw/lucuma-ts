import { createStore } from 'jotai';
import { afterEach, describe, expect, it } from 'vitest';

import { odbTokenAtom, tokenExpAtom, userAtom } from '../atoms.ts';
import { fakeJwt, serviceUser, standardUser } from './factories.ts';

afterEach(() => {
  // odbTokenAtom persists to sessionStorage, which outlives the per-test store.
  sessionStorage.clear();
});

describe(fakeJwt, () => {
  it.each([
    ['Zoë', 'a Latin name with a diacritic'],
    ['李', 'a CJK name'],
  ])('decodes a token for a givenName of %s (%s)', (givenName) => {
    const store = createStore();
    const user = standardUser('pi');
    const token = fakeJwt({ ...user, profile: { ...user.profile, profile: { ...user.profile.profile, givenName } } });

    store.set(odbTokenAtom, token);

    const decoded = store.get(userAtom);
    expect(decoded).not.toBeNull();
    expect(decoded?.type === 'standard' ? decoded.profile.profile.givenName : undefined).toBe(givenName);
    expect(store.get(tokenExpAtom)).toBeInstanceOf(Date);
  });

  it('expires the given number of seconds from now', () => {
    const store = createStore();

    store.set(odbTokenAtom, fakeJwt(serviceUser(), -60));
    expect(store.get(tokenExpAtom)!.getTime()).toBeLessThan(Date.now());

    store.set(odbTokenAtom, fakeJwt(serviceUser(), 60));
    expect(store.get(tokenExpAtom)!.getTime()).toBeGreaterThan(Date.now());
    expect(store.get(userAtom)).toEqual(serviceUser());
  });
});
