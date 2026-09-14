import type { StandardUser } from '@gemini-hlsw/lucuma-common-ui';
import { createStore, Provider } from 'jotai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { odbTokenAtom } from '@/components/atoms/auth';

import { AuthSession } from './AuthSession';
import * as sso from './ssoClient';

vi.mock('./ssoClient');

const USER: StandardUser = {
  type: 'standard',
  id: 'u-1',
  role: { type: 'staff', id: 'r-1' },
  otherRoles: [],
  profile: { orcidId: '0000-0001', profile: { givenName: 'Ada', familyName: 'Lovelace' } },
};

/** An unsigned JWT carrying the payload the auth atoms decode; the client never
 *  verifies the signature, so that segment is a placeholder. */
function jwt(expiresInSeconds = 600): string {
  const encode = (value: unknown): string => btoa(JSON.stringify(value));
  const header = encode({ alg: 'none', typ: 'JWT' });
  const payload = encode({ 'lucuma-user': USER, exp: Math.floor(Date.now() / 1000) + expiresInSeconds });
  return `${header}.${payload}.signature`;
}

async function mountSession(initialToken?: string) {
  // A fresh store per test, so one test's token cannot sign the next one in.
  const store = createStore();
  if (initialToken !== undefined) store.set(odbTokenAtom, initialToken);
  const screen = await render(
    <Provider store={store}>
      <AuthSession />
    </Provider>,
  );
  return { store, screen };
}

describe(AuthSession, () => {
  beforeEach(() => {
    // odbTokenAtom is sessionStorage-backed and reads on init.
    window.sessionStorage.clear();
  });

  it('signs a returning user in from the refresh-token cookie', async () => {
    const token = jwt();
    vi.mocked(sso.refreshToken).mockResolvedValue(token);

    const { store } = await mountSession();

    await expect.poll(() => store.get(odbTokenAtom)).toBe(token);
  });

  it('stays signed out when SSO reports no session', async () => {
    vi.mocked(sso.refreshToken).mockResolvedValue(null);

    const { store } = await mountSession();

    await expect.poll(() => vi.mocked(sso.refreshToken).mock.calls.length).toBeGreaterThan(0);
    expect(store.get(odbTokenAtom)).toBeNull();
  });

  it('leaves a live session alone instead of re-bootstrapping it', async () => {
    const token = jwt();
    vi.mocked(sso.refreshToken).mockResolvedValue(jwt(999));

    const { store } = await mountSession(token);

    expect(sso.refreshToken).not.toHaveBeenCalled();
    expect(store.get(odbTokenAtom)).toBe(token);
  });

  it('drops a bootstrap token that arrives after unmount', async () => {
    let resolve!: (token: string | null) => void;
    const pending = new Promise<string | null>((r) => (resolve = r));
    vi.mocked(sso.refreshToken).mockReturnValue(pending);

    const { store, screen } = await mountSession();
    await screen.unmount();

    resolve(jwt());
    // The component's own .then was registered first, so it has run by here.
    await pending;
    expect(store.get(odbTokenAtom)).toBeNull();
  });

  it('refreshes a token nearing expiry and installs the fresh one', async () => {
    const expiring = jwt(10); // valid, but inside the 30s anticipation window
    const fresh = jwt(600);
    vi.mocked(sso.refreshToken).mockResolvedValue(fresh);

    const { store } = await mountSession(expiring);

    // The once-per-second expiry check runs on real timers.
    await expect.poll(() => store.get(odbTokenAtom), { timeout: 5000 }).toBe(fresh);
  });

  it('starts no second refresh while one is still in flight', async () => {
    // Only the interval is faked, so React's scheduler stays real.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      let resolve!: (token: string | null) => void;
      vi.mocked(sso.refreshToken).mockReturnValue(new Promise<string | null>((r) => (resolve = r)));

      await mountSession(jwt(10));

      vi.advanceTimersByTime(5000);
      expect(sso.refreshToken).toHaveBeenCalledTimes(1);
      resolve(null);
    } finally {
      vi.useRealTimers();
    }
  });

  it('backs off after an empty refresh instead of retrying every second', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      vi.mocked(sso.refreshToken).mockResolvedValue(null);

      await mountSession(jwt(10));

      // The async advance flushes the null result between ticks, so the
      // in-flight guard has released and only the backoff holds the line.
      await vi.advanceTimersByTimeAsync(1000);
      expect(sso.refreshToken).toHaveBeenCalledTimes(1);
      // Date is not faked, so these ticks all land inside the 30s backoff.
      await vi.advanceTimersByTimeAsync(10_000);
      expect(sso.refreshToken).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
