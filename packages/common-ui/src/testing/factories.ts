import type { ServiceUser, StandardUser, User } from '../auth.ts';

/** A standard user with the given active role, for auth-dependent tests. */
export function standardUser(roleType: StandardUser['role']['type']): StandardUser {
  return {
    type: 'standard',
    id: 'u-1',
    role: { type: roleType, id: 'r-1' },
    otherRoles: [],
    profile: { orcidId: '0000-0001', profile: { givenName: 'Ada', familyName: 'Lovelace' } },
  };
}

/** A staff user whose display name is the ORCID credit name `name`. */
export function namedUser(name: string): StandardUser {
  const base = standardUser('staff');
  return { ...base, profile: { ...base.profile, profile: { creditName: name } } };
}

/** A service user, as the navigate server and other backends sign in. */
export function serviceUser(name = 'invalid-user-for-tests'): ServiceUser {
  return { type: 'service', id: 'u-000', name };
}

/**
 * An unsigned JWT with the SSO payload the auth atoms decode. It expires
 * `expiresInSeconds` seconds from now. A negative value gives an expired token.
 */
export function fakeJwt(user: User, expiresInSeconds = 3600): string {
  // btoa only takes Latin-1, so encode UTF-8 bytes first.
  // Use standard base64, not base64url: decodedTokenPayloadAtom decodes with atob.
  const encode = (value: unknown): string =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value)))).replace(/=+$/, '');
  const header = encode({ alg: 'none', typ: 'JWT' });
  const payload = encode({ 'lucuma-user': user, exp: Date.now() / 1000 + expiresInSeconds });
  // The client only decodes, so the signature is never checked.
  return `${header}.${payload}.signature`;
}
