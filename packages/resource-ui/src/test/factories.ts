import type { StandardUser, User } from '@gemini-hlsw/lucuma-common-ui';

export function standardUser(roleType: 'pi' | 'ngo' | 'staff' | 'admin'): StandardUser {
  return {
    type: 'standard',
    id: 'u-1',
    role: { type: roleType, id: 'r-1' },
    otherRoles: [],
    profile: { orcidId: '0000-0001', profile: { givenName: 'Ada', familyName: 'Lovelace' } },
  };
}

export function namedUser(name: string): StandardUser {
  const base = standardUser('staff');
  return { ...base, profile: { ...base.profile, profile: { creditName: name } } };
}

export function fakeJwt(user: User, expiresInSeconds = 3600): string {
  // Standard base64, not base64url: common-ui's decodedTokenPayloadAtom decodes with plain atob.
  const encode = (value: unknown): string =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value)))).replace(/=+$/, '');
  const header = encode({ alg: 'none', typ: 'JWT' });
  const payload = encode({ 'lucuma-user': user, exp: Math.floor(Date.now() / 1000) + expiresInSeconds });
  return `${header}.${payload}.signature`;
}
