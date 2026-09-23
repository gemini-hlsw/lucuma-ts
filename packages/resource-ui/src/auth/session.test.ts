import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  expiryTickAtom,
  isLoggedInAtom,
  odbTokenAtom,
  sessionCheckedAtom,
  sessionStatusAtom,
} from '@/components/atoms/auth';
import { store } from '@/components/atoms/store';
import { fakeJwt, standardUser } from '@/test/factories';
import { type PendingSsoCall, ssoCall as call, ssoCalls, stubSso } from '@/test/sso';

import { pendingRefresh, signOut, startSession } from './session';

let stop: (() => void) | undefined;

const refreshes = (): PendingSsoCall[] => ssoCalls().filter((made) => made.url.includes('/api/v1/refresh-token'));

const tokenFor = (role: 'pi' | 'staff' = 'staff', expiresInSeconds = 3600): string =>
  fakeJwt(standardUser(role), expiresInSeconds);

beforeEach(() => {
  stubSso();
});

afterEach(() => {
  stop?.();
  stop = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe(startSession, () => {
  it('signs a returning reader in from the SSO session cookie', async () => {
    stop = startSession();
    const settled = pendingRefresh();
    expect(refreshes()).toHaveLength(1);

    const token = tokenFor();
    call(0).answer({ body: token });
    await settled;

    expect(store.get(odbTokenAtom)).toBe(token);
    expect(store.get(isLoggedInAtom)).toBe(true);
    expect(store.get(sessionCheckedAtom)).toBe(true);
  });

  it('leaves a visitor signed out, and says the question was asked', async () => {
    stop = startSession();
    const settled = pendingRefresh();

    call(0).answer({ status: 403 });
    await settled;

    expect(store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionCheckedAtom)).toBe(true);
  });

  it('asks SSO nothing when the stored token is still good', () => {
    const token = tokenFor();
    store.set(odbTokenAtom, token);

    stop = startSession();

    expect(ssoCalls()).toHaveLength(0);
    expect(store.get(sessionCheckedAtom)).toBe(true);
    expect(store.get(odbTokenAtom)).toBe(token);
  });

  it('refreshes at the token own expiry and not a moment earlier', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    store.set(odbTokenAtom, tokenFor('staff', 120));

    stop = startSession();

    vi.advanceTimersByTime(89_000);
    expect(refreshes()).toHaveLength(0);

    vi.advanceTimersByTime(2_000);
    expect(refreshes()).toHaveLength(1);
  });

  it('collapses two triggers inside one window into one request', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    store.set(odbTokenAtom, tokenFor('staff', 20));

    stop = startSession();
    document.dispatchEvent(new Event('visibilitychange'));
    const settled = pendingRefresh();
    expect(refreshes()).toHaveLength(1);

    call(0).answer({ body: tokenFor('staff', 20) });
    await settled;

    document.dispatchEvent(new Event('visibilitychange'));
    expect(refreshes()).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(refreshes()).toHaveLength(1);

    vi.advanceTimersByTime(29_999);
    expect(refreshes()).toHaveLength(2);
  });

  it('keeps one in-flight refresh when a second trigger crosses the retry floor before it lands', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    store.set(odbTokenAtom, tokenFor('staff', 120));

    stop = startSession();

    vi.advanceTimersByTime(90_000);
    const settled = pendingRefresh();
    expect(refreshes()).toHaveLength(1);

    vi.advanceTimersByTime(31_000);
    document.dispatchEvent(new Event('visibilitychange'));

    expect(refreshes()).toHaveLength(1);
    expect(pendingRefresh()).toBe(settled);

    const token = tokenFor('staff', 20);
    call(0).answer({ body: token });
    await settled;

    expect(store.get(odbTokenAtom)).toBe(token);
  });

  it('keeps a still-valid token when SSO cannot be reached, and waits out the backoff', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const token = tokenFor('staff', 20);
    store.set(odbTokenAtom, token);

    stop = startSession();
    vi.advanceTimersByTime(1);
    const settled = pendingRefresh();
    expect(refreshes()).toHaveLength(1);

    call(0).answer({ status: 500 });
    await settled;

    expect(store.get(odbTokenAtom)).toBe(token);

    vi.advanceTimersByTime(29_000);
    expect(refreshes()).toHaveLength(1);

    vi.advanceTimersByTime(2_000);
    expect(refreshes()).toHaveLength(2);
  });

  it('doubles the backoff on each unreachable answer and caps it at 16 minutes', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    store.set(odbTokenAtom, tokenFor('staff', 20));

    stop = startSession();
    vi.advanceTimersByTime(1);
    let settled = pendingRefresh();
    call(0).answer({ status: 500 });
    await settled;

    const expectedDelaysMs = [30_000, 60_000, 120_000, 240_000, 480_000, 960_000, 960_000];
    for (const [round, delayMs] of expectedDelaysMs.entries()) {
      vi.advanceTimersByTime(delayMs - 1);
      expect(refreshes()).toHaveLength(round + 1);

      vi.advanceTimersByTime(1);
      expect(refreshes()).toHaveLength(round + 2);

      settled = pendingRefresh();
      call(round + 1).answer({ status: 500 });
      await settled;
    }

    expect(store.get(odbTokenAtom)).toBeNull();
  });

  it('resets the backoff once a refresh finally succeeds, rather than keeping the wait it grew to', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    store.set(odbTokenAtom, tokenFor('staff', 20));

    stop = startSession();
    vi.advanceTimersByTime(1);
    let settled = pendingRefresh();
    call(0).answer({ status: 500 });
    await settled;

    vi.advanceTimersByTime(30_000);
    settled = pendingRefresh();
    call(1).answer({ status: 500 });
    await settled;

    vi.advanceTimersByTime(60_000);
    settled = pendingRefresh();
    call(2).answer({ body: tokenFor('staff', 1) });
    await settled;

    vi.advanceTimersByTime(29_999);
    expect(refreshes()).toHaveLength(3);

    vi.advanceTimersByTime(1);
    expect(refreshes()).toHaveLength(4);
  });

  it('re-arms without storming when the fresh token expires when the old one did', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const token = tokenFor('staff', 20);
    store.set(odbTokenAtom, token);

    stop = startSession();
    vi.advanceTimersByTime(1);
    const settled = pendingRefresh();
    call(0).answer({ body: token });
    await settled;

    vi.advanceTimersByTime(29_000);
    expect(refreshes()).toHaveLength(1);

    vi.advanceTimersByTime(2_000);
    expect(refreshes()).toHaveLength(2);
  });

  it('asks a visitor with no session once, and not again when the backoff windows go by', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });

    stop = startSession();
    const settled = pendingRefresh();
    expect(refreshes()).toHaveLength(1);

    call(0).answer({ status: 403 });
    await settled;

    expect(store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionCheckedAtom)).toBe(true);

    vi.advanceTimersByTime(10_000_000);
    expect(refreshes()).toHaveLength(1);
  });

  it('drops a token that cannot be decoded, rather than holding it with no timer', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });

    stop = startSession();
    const settled = pendingRefresh();
    expect(refreshes()).toHaveLength(1);

    call(0).answer({ body: 'header.payload.signature' });
    await settled;

    expect(store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionStatusAtom)).toBe('signed-out');
    expect(store.get(sessionCheckedAtom)).toBe(true);

    vi.advanceTimersByTime(10_000_000);
    expect(refreshes()).toHaveLength(1);
  });

  it('drops a token SSO hands back already expired, and arms no timer for it', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      stop = startSession();
      const settled = pendingRefresh();
      expect(refreshes()).toHaveLength(1);

      call(0).answer({ body: tokenFor('staff', -60) });
      await settled;

      expect(store.get(odbTokenAtom)).toBeNull();
      expect(store.get(sessionStatusAtom)).toBe('signed-out');
      expect(store.get(sessionCheckedAtom)).toBe(true);
      expect(warned).toHaveBeenCalledTimes(1);
      expect(warned).toHaveBeenCalledWith(expect.stringMatching(/ahead of the server/));

      vi.advanceTimersByTime(60 * 60_000);
      expect(refreshes()).toHaveLength(1);
    } finally {
      warned.mockRestore();
    }
  });

  it('treats a stored undecodable token as no token at bootstrap', async () => {
    store.set(odbTokenAtom, 'header.payload.signature');

    stop = startSession();
    const settled = pendingRefresh();
    expect(refreshes()).toHaveLength(1);

    call(0).answer({ status: 403 });
    await settled;

    expect(store.get(odbTokenAtom)).toBeNull();
  });

  it('asks again on the backoff when SSO is unreachable for a visitor with no token', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });

    stop = startSession();
    const settled = pendingRefresh();
    expect(refreshes()).toHaveLength(1);

    call(0).answer({ status: 500 });
    await settled;

    expect(store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionCheckedAtom)).toBe(true);

    vi.advanceTimersByTime(29_999);
    expect(refreshes()).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(refreshes()).toHaveLength(2);
  });

  it('signs the reader out when a refresh is rejected', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    store.set(odbTokenAtom, tokenFor('staff', 20));

    stop = startSession();
    vi.advanceTimersByTime(1);
    const settled = pendingRefresh();

    call(0).answer({ status: 401 });
    await settled;

    expect(store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionCheckedAtom)).toBe(true);

    vi.advanceTimersByTime(10_000_000);
    expect(refreshes()).toHaveLength(1);
  });

  it('refreshes a token past its deadline as soon as the tab is looked at again', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    store.set(odbTokenAtom, tokenFor('staff', 20));

    stop = startSession();
    document.dispatchEvent(new Event('visibilitychange'));
    const settled = pendingRefresh();
    expect(refreshes()).toHaveLength(1);

    call(0).answer({ status: 500 });
    await settled;

    document.dispatchEvent(new Event('visibilitychange'));

    expect(refreshes()).toHaveLength(1);
  });

  it('waits rather than firing at once for a token that expires months from now', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    store.set(odbTokenAtom, tokenFor('staff', 60 * 24 * 60 * 60));

    stop = startSession();

    vi.advanceTimersByTime(2_147_483_646);
    expect(refreshes()).toHaveLength(0);

    vi.advanceTimersByTime(1);
    expect(refreshes()).toHaveLength(1);
  });

  it('aborts the refresh it started when it is stopped, and changes nothing afterwards', async () => {
    const stopNow = startSession();
    const settled = pendingRefresh();
    const { signal } = call(0);

    stopNow();
    expect(signal?.aborted).toBe(true);

    call(0).answer({ body: tokenFor() });
    await settled;

    expect(store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionCheckedAtom)).toBe(false);
  });

  it('settles and reports when a token subscriber throws, instead of rejecting the refresh', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const reported = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const unsubscribe = store.sub(odbTokenAtom, () => {
      throw new Error('a token subscriber failed');
    });

    try {
      stop = startSession();
      const settled = pendingRefresh();
      const token = tokenFor('staff', 20);

      call(0).answer({ body: token });
      await settled;

      expect(store.get(odbTokenAtom)).toBe(token);
      expect(store.get(sessionCheckedAtom)).toBe(true);
      expect(reported).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(30_000);
      expect(refreshes()).toHaveLength(2);
    } finally {
      unsubscribe();
      reported.mockRestore();
    }
  });

  it('leaves one live session when React mounts, unmounts and mounts again', async () => {
    const stopFirst = startSession();
    const first = pendingRefresh();
    stopFirst();

    stop = startSession();
    const second = pendingRefresh();

    expect(refreshes()).toHaveLength(2);
    expect(call(0).signal?.aborted).toBe(true);
    expect(call(1).signal?.aborted).toBe(false);

    const survivor = tokenFor('staff');
    call(0).answer({ body: tokenFor('pi') });
    call(1).answer({ body: survivor });
    await Promise.all([first, second]);

    expect(store.get(odbTokenAtom)).toBe(survivor);
    expect(refreshes()).toHaveLength(2);
  });

  it('drops a token that has already expired when SSO will not renew it, and stops asking', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    store.set(odbTokenAtom, tokenFor('staff', -60));

    stop = startSession();
    const settled = pendingRefresh();
    expect(refreshes()).toHaveLength(1);

    call(0).answer({ status: 403 });
    await settled;

    expect(store.get(sessionStatusAtom)).toBe('signed-out');
    expect(store.get(odbTokenAtom)).toBeNull();

    vi.advanceTimersByTime(60 * 60_000);
    expect(refreshes()).toHaveLength(1);
  });

  it('drops a token once it expires while SSO is unreachable, and keeps asking on the backoff', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const token = tokenFor('staff', 20);
    store.set(odbTokenAtom, token);

    stop = startSession();
    vi.advanceTimersByTime(1);
    let settled = pendingRefresh();
    call(0).answer({ status: 500 });
    await settled;
    expect(store.get(odbTokenAtom)).toBe(token);

    vi.advanceTimersByTime(30_000);
    settled = pendingRefresh();
    expect(refreshes()).toHaveLength(2);
    call(1).answer({ status: 500 });
    await settled;

    expect(store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionStatusAtom)).toBe('signed-out');

    vi.advanceTimersByTime(60_000);
    expect(refreshes()).toHaveLength(3);
  });

  it('does not let a tab focus inside the backoff window pull the retry forward', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    store.set(odbTokenAtom, tokenFor('staff', 20));

    stop = startSession();
    vi.advanceTimersByTime(1);
    let settled = pendingRefresh();
    call(0).answer({ status: 500 });
    await settled;

    vi.advanceTimersByTime(30_000);
    settled = pendingRefresh();
    call(1).answer({ status: 500 });
    await settled;

    vi.advanceTimersByTime(31_000);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(refreshes()).toHaveLength(2);

    vi.advanceTimersByTime(29_000);
    expect(refreshes()).toHaveLength(3);
  });

  it('reports signed-out once the token expires mid-refresh, and signed-in again when the refresh lands', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    store.set(odbTokenAtom, tokenFor('staff', 20));

    stop = startSession();
    vi.advanceTimersByTime(1);
    expect(refreshes()).toHaveLength(1);
    expect(store.get(sessionStatusAtom)).toBe('signed-in');

    vi.advanceTimersByTime(20_000);
    expect(refreshes()).toHaveLength(1);
    expect(store.get(sessionStatusAtom)).toBe('signed-out');

    const settled = pendingRefresh();
    call(0).answer({ body: tokenFor('staff', 20) });
    await settled;

    expect(store.get(sessionStatusAtom)).toBe('signed-in');
  });

  it('clears the expiry tick timer when the session is stopped before the token expires', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    store.set(odbTokenAtom, tokenFor('staff', 20));

    const stopNow = startSession();
    const before = store.get(expiryTickAtom);

    stopNow();
    vi.advanceTimersByTime(25_000);

    expect(store.get(expiryTickAtom)).toBe(before);
  });
});

describe(signOut, () => {
  it('discards a refresh already in flight when signOut runs, and arms no new timer once it lands', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    store.set(odbTokenAtom, tokenFor('staff', 20));

    stop = startSession();
    vi.advanceTimersByTime(1);
    const late = pendingRefresh();
    expect(refreshes()).toHaveLength(1);

    const signedOut = signOut();
    expect(store.get(odbTokenAtom)).toBeNull();

    call(0).answer({ body: tokenFor('pi') });
    await late;
    const logoutCall = ssoCalls().find((made) => made.url.includes('/api/v1/logout'));
    logoutCall?.answer({ status: 200 });

    expect(await signedOut).toEqual({ reachedSso: true });
    expect(store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionCheckedAtom)).toBe(true);

    vi.advanceTimersByTime(10_000_000);
    expect(refreshes()).toHaveLength(1);
  });

  it('settles the session as signed out when the reader signs out mid-bootstrap', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    stop = startSession();
    const bootstrap = pendingRefresh();
    expect(refreshes()).toHaveLength(1);

    const signedOut = signOut();
    ssoCalls()
      .find((made) => made.url.includes('/api/v1/logout'))
      ?.answer({ status: 200 });
    expect(await signedOut).toEqual({ reachedSso: true });

    call(0).answer({ body: tokenFor() });
    await bootstrap;

    expect(store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionCheckedAtom)).toBe(true);
    expect(store.get(sessionStatusAtom)).toBe('signed-out');

    vi.advanceTimersByTime(200_000);
    expect(refreshes()).toHaveLength(1);
  });

  it('still signs the reader out here when SSO refuses the logout', async () => {
    stop = startSession();
    call(0).answer({ status: 403 });
    await pendingRefresh();

    const signedOut = signOut();
    const logoutCall = ssoCalls().find((made) => made.url.includes('/api/v1/logout'));
    logoutCall?.answer({ status: 500, body: 'no session' });

    expect(await signedOut).toEqual({ reachedSso: false });
    expect(store.get(odbTokenAtom)).toBeNull();
  });

  it('still resolves and posts the logout when a token subscriber throws', async () => {
    const reported = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    store.set(odbTokenAtom, tokenFor());
    stop = startSession();

    const unsubscribe = store.sub(odbTokenAtom, () => {
      throw new Error('a token subscriber failed');
    });

    try {
      const signedOut = signOut();
      const logoutCall = ssoCalls().find((made) => made.url.includes('/api/v1/logout'));
      logoutCall?.answer({ status: 200 });

      expect(await signedOut).toEqual({ reachedSso: true });
      expect(store.get(odbTokenAtom)).toBeNull();
      expect(store.get(sessionCheckedAtom)).toBe(true);
      expect(logoutCall).toBeDefined();
      expect(reported).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
      reported.mockRestore();
    }
  });

  it('keeps the reader signed out when the tab is looked at again after a failed logout', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    store.set(odbTokenAtom, tokenFor('staff', 20));

    stop = startSession();

    const signedOut = signOut();
    const logoutCall = ssoCalls().find((made) => made.url.includes('/api/v1/logout'));
    logoutCall?.answer({ status: 500 });
    expect(await signedOut).toEqual({ reachedSso: false });

    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(10_000_000);

    expect(refreshes()).toHaveLength(0);
    expect(store.get(odbTokenAtom)).toBeNull();
  });

  it('clears the expiry tick timer when signOut tears the session down before the token expires', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    store.set(odbTokenAtom, tokenFor('staff', 20));

    stop = startSession();
    const before = store.get(expiryTickAtom);

    const signedOut = signOut();
    const logoutCall = ssoCalls().find((made) => made.url.includes('/api/v1/logout'));
    logoutCall?.answer({ status: 200 });
    await signedOut;

    vi.advanceTimersByTime(25_000);

    expect(store.get(expiryTickAtom)).toBe(before);
  });
});
