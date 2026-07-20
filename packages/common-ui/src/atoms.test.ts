import { createStore } from 'jotai';
import type { Store } from 'jotai/vanilla/store';

import {
  decodedTokenPayloadAtom,
  isLoggedInAtom,
  odbTokenAtom,
  type OdbTokenPayload,
  tokenExpAtom,
  userAtom,
} from './atoms.ts';
import type { StandardUser } from './auth.ts';

describe('auth atoms', () => {
  let store: Store;
  beforeEach(() => {
    store = createStore();
  });

  describe('decodedTokenPayloadAtom', () => {
    it('should decode the token payload', () => {
      const { token, payload } = createStandardUserToken(Date.now() / 1000 + 60);

      store.set(odbTokenAtom, token);
      expect(store.get(decodedTokenPayloadAtom)).toEqual(payload);
    });

    it('is null if the token is not set', () => {
      store.set(odbTokenAtom, null);
      expect(store.get(decodedTokenPayloadAtom)).toBeNull();
    });

    it('is null if the token is invalid', () => {
      store.set(odbTokenAtom, 'invalid token');
      expect(store.get(decodedTokenPayloadAtom)).toBeNull();
    });

    it('is null if the token payload is not decodable', () => {
      store.set(odbTokenAtom, 'header.not-valid-base64-json.signature');
      expect(store.get(decodedTokenPayloadAtom)).toBeNull();
    });
  });

  describe('userAtom', () => {
    it('gets the user from the payload', () => {
      const { token, payload } = createStandardUserToken();

      store.set(odbTokenAtom, token);
      expect(store.get(userAtom)).toEqual(payload['lucuma-user']);
    });
  });

  describe('tokenExpAtom', () => {
    it('gets the expiration date from the payload', () => {
      const expDate = Date.now();
      const { token } = createStandardUserToken(expDate / 1000);

      store.set(odbTokenAtom, token);
      expect(store.get(tokenExpAtom)).toEqual(new Date(expDate));
    });

    it('is null if the token is not set', () => {
      store.set(odbTokenAtom, null);
      expect(store.get(tokenExpAtom)).toBeNull();
    });
  });

  describe('isLoggedInAtom', () => {
    it('is true if the user is logged in and the token is not expired', () => {
      const { token } = createStandardUserToken(Date.now() / 1000 + 60);

      store.set(odbTokenAtom, token);
      expect(store.get(isLoggedInAtom)).true;
    });

    it('is false if the user is logged in and the token is expired', () => {
      const { token } = createStandardUserToken(Date.now() / 1000 - 60);

      store.set(odbTokenAtom, token);
      expect(store.get(isLoggedInAtom)).false;
    });

    it('is false if the token carries a user but no expiry', () => {
      // A payload with a user but no `exp` has no known expiry, so treat it as
      // not logged in rather than assuming it is valid forever.
      const base64 = (o: unknown) => btoa(JSON.stringify(o));
      const token = `${base64({ typ: 'JWT' })}.${base64({ 'lucuma-user': { type: 'guest', id: '1' } })}.sig`;
      store.set(odbTokenAtom, token);
      expect(store.get(isLoggedInAtom)).false;
    });

    it('is false if the user is not logged in', () => {
      store.set(odbTokenAtom, null);
      expect(store.get(isLoggedInAtom)).false;
    });
  });
});

function createStandardUserToken(overrideExp = Date.now() / 1000 + 60, overrides: Partial<StandardUser> = {}) {
  const payload: OdbTokenPayload = {
    exp: overrideExp,
    'lucuma-user': {
      id: '123',
      type: 'standard',
      otherRoles: [],
      ...overrides,
      role: {
        type: 'pi',
        id: '123',
        ...overrides?.role,
      },
      profile: {
        orcidId: '0000-0000-0000-0000',
        ...overrides?.profile,
        profile: {
          ...overrides?.profile?.profile,
        },
      },
    },
  };
  return createJwt(payload);
}

function createJwt<T>(payload: T) {
  const base64Payload = btoa(JSON.stringify(payload));
  const base64Header = btoa(JSON.stringify({ typ: 'JWT', alg: 'RS512' }));
  const signature = 'signature'; // Placeholder for the signature
  return { token: `${base64Header}.${base64Payload}.${signature}`, payload };
}
