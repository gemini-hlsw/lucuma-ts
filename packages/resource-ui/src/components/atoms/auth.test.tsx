import { fakeJwt, standardUser } from '@gemini-hlsw/lucuma-common-ui/testing';
import { createStore, type Store } from 'jotai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isLoggedInAtom,
  odbTokenAtom,
  sessionCheckedAtom,
  sessionEndingAtom,
  sessionStatusAtom,
  setToken,
  useSessionStatus,
} from './auth';

let store: Store;

beforeEach(() => {
  store = createStore();
});

describe(useSessionStatus, () => {
  it('reads checking before the session has been asked', () => {
    expect(store.get(sessionStatusAtom)).toBe('checking');
  });

  it('reads signed-out once checked with no token', () => {
    store.set(sessionCheckedAtom, true);

    expect(store.get(sessionStatusAtom)).toBe('signed-out');
  });

  it('should read checking until the session has been checked, then signed-in, when the token is valid', () => {
    store.set(odbTokenAtom, fakeJwt(standardUser('staff')));

    expect(store.get(sessionStatusAtom)).toBe('checking');

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
  it('should forget how the last session ended when a token arrives', () => {
    store.set(sessionEndingAtom, 'lapsed');

    setToken(store, fakeJwt(standardUser('staff')));

    expect(store.get(sessionEndingAtom)).toBe('none');
  });

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
    store.sub(odbTokenAtom, () => {
      throw new Error('a token subscriber failed');
    });

    expect(() => {
      setToken(store, fakeJwt(standardUser('staff')));
    }).toThrow(AggregateError);
  });
});
