import { describe, expect, it } from 'vitest';

import { odbTokenAtom, tokenExpAtom, userAtom } from '@/components/atoms/auth';
import { store } from '@/components/atoms/store';

import { fakeJwt, standardUser } from './factories';

describe(fakeJwt, () => {
  it.each([
    ['Zoë', 'a Latin name with a diacritic'],
    ['李', 'a CJK name'],
  ])('decodes a token for a givenName of %s (%s)', (givenName) => {
    const user = standardUser('pi');
    const token = fakeJwt({ ...user, profile: { ...user.profile, profile: { ...user.profile.profile, givenName } } });

    store.set(odbTokenAtom, token);

    const decoded = store.get(userAtom);
    expect(decoded).not.toBeNull();
    expect(decoded?.type === 'standard' ? decoded.profile.profile.givenName : undefined).toBe(givenName);
    expect(store.get(tokenExpAtom)).toBeInstanceOf(Date);
  });
});
