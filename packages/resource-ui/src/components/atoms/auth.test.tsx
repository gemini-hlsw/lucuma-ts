import { fakeJwt, standardUser } from '@gemini-hlsw/lucuma-common-ui/testing';
import { createStore, type Store } from 'jotai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isLoggedInAtom,
  odbTokenAtom,
  sessionCheckedAtom,
  sessionStatusAtom,
  setToken,
  useSessionStatus,
} from './auth';

let store: Store;

beforeEach(() => {
  store = createStore();
});

describe(useSessionStatus, () => {
  it('should read checking when the session has not been asked yet', () => {
    expect(store.get(sessionStatusAtom)).toBe('checking');
  });

  it('should read signed-out when checked with no token', () => {
    store.set(sessionCheckedAtom, true);

    expect(store.get(sessionStatusAtom)).toBe('signed-out');
  });

  it('should read signed-in when the token is valid, checked or not', () => {
    store.set(odbTokenAtom, fakeJwt(standardUser('staff')));

    expect(store.get(sessionStatusAtom)).toBe('signed-in');

    store.set(sessionCheckedAtom, true);
    expect(store.get(sessionStatusAtom)).toBe('signed-in');
  });

  it('should read signed-out when the token has expired and the session has been checked', () => {
    store.set(odbTokenAtom, fakeJwt(standardUser('staff'), -10));
    store.set(sessionCheckedAtom, true);

    expect(store.get(sessionStatusAtom)).toBe('signed-out');
  });

  it('should read checking, not signed-out, when the token has expired but the session has not been checked', () => {
    store.set(odbTokenAtom, fakeJwt(standardUser('staff'), -10));

    expect(store.get(sessionStatusAtom)).toBe('checking');
  });
});

describe(setToken, () => {
  it('should hold the session for the tab when storage refuses to persist it', () => {
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

  it('should let the failure out instead of reading it as a refused write when a subscriber throws', () => {
    store.sub(odbTokenAtom, () => {
      throw new Error('a token subscriber failed');
    });

    expect(() => {
      setToken(store, fakeJwt(standardUser('staff')));
    }).toThrow(AggregateError);
  });
});
