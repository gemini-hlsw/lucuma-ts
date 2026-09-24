import { describe, expect, it, vi } from 'vitest';

import { fakeJwt, standardUser } from '@/test/factories';

import {
  isLoggedInAtom,
  odbTokenAtom,
  sessionCheckedAtom,
  sessionStatusAtom,
  setToken,
  useSessionStatus,
} from './auth';
import { store } from './store';

describe(useSessionStatus, () => {
  it('reads checking before the session has been asked', () => {
    expect(store.get(sessionStatusAtom)).toBe('checking');
  });

  it('reads signed-out once checked with no token', () => {
    store.set(sessionCheckedAtom, true);

    expect(store.get(sessionStatusAtom)).toBe('signed-out');
  });

  it('reads signed-in for a valid token, checked or not', () => {
    store.set(odbTokenAtom, fakeJwt(standardUser('staff')));

    expect(store.get(sessionStatusAtom)).toBe('signed-in');

    store.set(sessionCheckedAtom, true);
    expect(store.get(sessionStatusAtom)).toBe('signed-in');
  });

  it('reads signed-out for an expired token once the session has been checked', () => {
    store.set(odbTokenAtom, fakeJwt(standardUser('staff'), -10));
    store.set(sessionCheckedAtom, true);

    expect(store.get(sessionStatusAtom)).toBe('signed-out');
  });

  it('reads checking, not signed-out, for an expired token before the session has been checked', () => {
    store.set(odbTokenAtom, fakeJwt(standardUser('staff'), -10));

    expect(store.get(sessionStatusAtom)).toBe('checking');
  });
});

describe(setToken, () => {
  it('holds the session for the tab when storage refuses to persist it', () => {
    const jwt = fakeJwt(standardUser('staff'));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    });

    expect(() => {
      setToken(store, jwt);
    }).not.toThrow();

    expect(store.get(odbTokenAtom)).toBe(jwt);
    expect(store.get(isLoggedInAtom)).toBe(true);
  });

  it('lets a subscriber failure out instead of reading it as a refused write', () => {
    const unsubscribe = store.sub(odbTokenAtom, () => {
      throw new Error('a token subscriber failed');
    });

    try {
      expect(() => {
        setToken(store, fakeJwt(standardUser('staff')));
      }).toThrow(AggregateError);
    } finally {
      unsubscribe();
    }
  });
});
