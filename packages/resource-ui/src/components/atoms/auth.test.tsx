import { displayName } from '@gemini-hlsw/lucuma-common-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeJwt, standardUser } from '@/test/factories';
import { Probe } from '@/test/probe';
import { renderApp } from '@/test/renderApp';

import {
  isLoggedInAtom,
  odbTokenAtom,
  sessionCheckedAtom,
  sessionStatusAtom,
  setToken,
  useSessionStatus,
  useUser,
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

describe('renderApp signing a tree in', () => {
  const openProbe = (options: { token?: string | null; sessionChecked?: boolean }) =>
    renderApp({
      route: '/',
      element: (
        <Probe
          use={() => ({ user: useUser(), status: useSessionStatus() })}
          readout={({ user, status }) => ({ user: user ? displayName(user) : 'none', status })}
        />
      ),
      ...options,
    });

  it('shows the signed-in user and status for a valid token', async () => {
    const screen = await openProbe({ token: fakeJwt(standardUser('staff')) });

    await expect.element(screen.getByTestId('probe-user')).toHaveTextContent('Ada Lovelace');
    await expect.element(screen.getByTestId('probe-status')).toHaveTextContent('signed-in');
  });

  it('shows no user and signed-out with no token', async () => {
    const screen = await openProbe({});

    await expect.element(screen.getByTestId('probe-user')).toHaveTextContent('none');
    await expect.element(screen.getByTestId('probe-status')).toHaveTextContent('signed-out');
  });

  it('shows checking while the session has not been checked yet', async () => {
    const screen = await openProbe({ sessionChecked: false });

    await expect.element(screen.getByTestId('probe-status')).toHaveTextContent('checking');
  });
});

describe(setToken, () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
