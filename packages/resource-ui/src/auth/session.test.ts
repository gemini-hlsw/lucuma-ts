import { fakeJwt, standardUser } from '@gemini-hlsw/lucuma-common-ui/testing';
import { createStore, type Store } from 'jotai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isLoggedInAtom,
  odbTokenAtom,
  sessionCheckedAtom,
  sessionEndingAtom,
  sessionStatusAtom,
  setToken,
} from '@/components/atoms/auth';
import { fakeTimeouts, UNDECODABLE_TOKEN } from '@/test/helpers';
import {
  answerRefresh,
  failRefresh,
  ssoCall as call,
  ssoCalls,
  ssoLogout,
  ssoRefreshes as refreshes,
  stubSso,
} from '@/test/sso';

import {
  pendingRefresh,
  SESSION_CHANNEL,
  SESSION_TIMINGS,
  type SessionTimings,
  SIGNED_OUT_MESSAGE,
  signOut,
  startSession,
} from './session';

const FAST: SessionTimings = { ...SESSION_TIMINGS, minIntervalMs: 10, backoffCapMs: 40 };
const TIMER_SLACK_MS = 2;

let store: Store;
let stop: (() => void) | undefined;
let otherTab: BroadcastChannel;

const holdToken = (expiresInSeconds?: number): string => {
  const token = fakeJwt(standardUser('staff'), expiresInSeconds);
  store.set(odbTokenAtom, token);
  return token;
};

/** A tab already past its load-time check, so the keeper has nothing to ask at start. */
const checkedToken = (expiresInSeconds?: number): string => {
  const token = holdToken(expiresInSeconds);
  store.set(sessionCheckedAtom, true);
  return token;
};

async function expectRefreshes(count: number): Promise<void> {
  await expect.poll(() => refreshes(), { interval: 1 }).toHaveLength(count);
}

/** Resolves once `data` from the other tab has been delivered to every channel open before the call. */
async function announceFromOtherTab(data: unknown): Promise<void> {
  const witness = new BroadcastChannel(SESSION_CHANNEL);
  const delivered = new Promise<void>((resolve) => {
    witness.addEventListener('message', () => resolve(), { once: true });
  });
  otherTab.postMessage(data);
  await delivered;
  witness.close();
}

beforeEach(() => {
  store = createStore();
  stubSso();
  otherTab = new BroadcastChannel(SESSION_CHANNEL);
});

afterEach(() => {
  stop?.();
  stop = undefined;
  otherTab.close();
  vi.useRealTimers();
});

describe(startSession, () => {
  it('should ask SSO for the store it was started with, and mark only that store checked, when SSO answers', async () => {
    const other = createStore();
    holdToken();

    stop = startSession(store);
    expect(store.get(sessionCheckedAtom)).toBe(false);

    await answerRefresh(0, { body: fakeJwt(standardUser('staff')) });

    expect(store.get(sessionCheckedAtom)).toBe(true);
    expect(other.get(sessionCheckedAtom)).toBe(false);
  });

  it('signs a returning reader in from the SSO session cookie', async () => {
    stop = startSession(store);
    expect(refreshes()).toHaveLength(1);

    const token = fakeJwt(standardUser('staff'));
    await answerRefresh(0, { body: token });

    expect(store.get(odbTokenAtom)).toBe(token);
    expect(store.get(isLoggedInAtom)).toBe(true);
    expect(store.get(sessionCheckedAtom)).toBe(true);
  });

  it('leaves a visitor signed out, and says the question was asked', async () => {
    stop = startSession(store);

    await answerRefresh(0, { status: 403 });

    expect(store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionCheckedAtom)).toBe(true);
  });

  it('should ask SSO once and take the fresh token over the stored one when the stored token is still good', async () => {
    const token = holdToken();

    stop = startSession(store);

    expect(refreshes()).toHaveLength(1);
    expect(store.get(sessionCheckedAtom)).toBe(false);
    expect(store.get(odbTokenAtom)).toBe(token);

    const fresh = fakeJwt(standardUser('staff'), 7200);
    await answerRefresh(0, { body: fresh });

    expect(store.get(odbTokenAtom)).toBe(fresh);
    expect(store.get(sessionCheckedAtom)).toBe(true);
  });

  it('should ask nothing at start when the store is already checked', () => {
    checkedToken();

    stop = startSession(store);

    expect(ssoCalls()).toHaveLength(0);
  });

  it('should refresh when the token reaches its own refresh deadline', async () => {
    checkedToken(0.1);

    stop = startSession(store, { ...FAST, refreshAheadMs: 60 });
    expect(refreshes()).toHaveLength(0);

    await expectRefreshes(1);
  });

  it('should ask nothing when the token has not reached its own refresh deadline', () => {
    fakeTimeouts();
    checkedToken(120);

    stop = startSession(store);

    vi.advanceTimersByTime(89_000);
    expect(refreshes()).toHaveLength(0);
  });

  it('asks nothing inside the minimum interval after an answer, from a refocus or its own timer', async () => {
    fakeTimeouts();
    holdToken(20);

    stop = startSession(store);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(refreshes()).toHaveLength(1);

    await answerRefresh(0, { body: fakeJwt(standardUser('staff'), 20) });

    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(29_000);
    expect(refreshes()).toHaveLength(1);
  });

  it('asks again once the minimum interval passes when the fresh token expires when the old one did', async () => {
    const token = holdToken(20);

    stop = startSession(store, FAST);
    await expectRefreshes(1);

    await answerRefresh(0, { body: token });

    await expectRefreshes(2);
  });

  it('keeps one in-flight refresh when a second trigger crosses the retry floor before it lands', async () => {
    holdToken(20);

    stop = startSession(store, { ...SESSION_TIMINGS, minIntervalMs: 0 });
    document.dispatchEvent(new Event('visibilitychange'));
    const settled = pendingRefresh();

    document.dispatchEvent(new Event('visibilitychange'));

    expect(refreshes()).toHaveLength(1);
    expect(pendingRefresh()).toBe(settled);

    const token = fakeJwt(standardUser('staff'));
    call(0).answer({ body: token });
    await settled;

    expect(store.get(odbTokenAtom)).toBe(token);
  });

  it.each(['a still-valid token', 'no token'] as const)(
    'should hold %s and ask again at the backoff mark when the load-time check cannot reach SSO',
    async (holding) => {
      fakeTimeouts();
      const token = holding === 'no token' ? null : fakeJwt(standardUser('staff'), 50);
      store.set(odbTokenAtom, token);

      stop = startSession(store);
      expect(refreshes()).toHaveLength(1);

      await failRefresh(0);

      expect(store.get(odbTokenAtom)).toBe(token);
      expect(store.get(sessionCheckedAtom)).toBe(true);
      vi.advanceTimersByTime(SESSION_TIMINGS.minIntervalMs - 1);
      expect(refreshes()).toHaveLength(1);

      vi.advanceTimersByTime(1);

      expect(refreshes()).toHaveLength(2);
      expect(store.get(odbTokenAtom)).toBe(token);
    },
  );

  it('doubles the backoff on each unreachable answer and caps it', async () => {
    const expectedDelaysMs = [10, 20, 40, 40, 40, 40];
    const waitedMs: number[] = [];

    stop = startSession(store, FAST);
    for (const [round, delayMs] of expectedDelaysMs.entries()) {
      const answeredAt = performance.now();
      await answerRefresh(round, { status: 500 });
      await expectRefreshes(round + 2);
      waitedMs.push(performance.now() - answeredAt);

      expect(waitedMs[round], `round ${round}`).toBeGreaterThanOrEqual(delayMs - TIMER_SLACK_MS);
    }

    // Uncapped, the last three rounds would wait 80, 160 and 320 ms.
    const cappedMs = waitedMs.slice(3).reduce((sum, ms) => sum + ms, 0);
    expect(cappedMs).toBeLessThan(80 + 160 + 320);
  });

  it('resets the backoff once a refresh finally succeeds, rather than keeping the wait it grew to', async () => {
    stop = startSession(store, { ...FAST, backoffCapMs: 1_000 });
    for (const round of [0, 1, 2, 3, 4, 5]) {
      await answerRefresh(round, { status: 500 });
      await expectRefreshes(round + 2);
    }

    await answerRefresh(6, { body: fakeJwt(standardUser('staff'), 20) });
    await expectRefreshes(8);

    const answeredAt = performance.now();
    await answerRefresh(7, { status: 500 });
    await expectRefreshes(9);

    expect(performance.now() - answeredAt).toBeLessThan(320);
  });

  it.each([
    [
      'SSO says a visitor has no session',
      async () => {
        stop = startSession(store);
        await answerRefresh(0, { status: 403 });
      },
    ],
    [
      'SSO rejects the refresh of a held token',
      async () => {
        holdToken(20);
        stop = startSession(store);
        document.dispatchEvent(new Event('visibilitychange'));
        await answerRefresh(0, { status: 401 });
      },
    ],
    [
      'SSO hands back a token that cannot be decoded',
      async () => {
        stop = startSession(store);
        await answerRefresh(0, { body: UNDECODABLE_TOKEN });
      },
    ],
    [
      'SSO hands back a token already expired',
      async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        stop = startSession(store);
        await answerRefresh(0, { body: fakeJwt(standardUser('staff'), -60) });
      },
    ],
    [
      'SSO will not renew a stored token that has already expired',
      async () => {
        holdToken(-60);
        stop = startSession(store);
        await answerRefresh(0, { status: 403 });
      },
    ],
  ])('asks SSO nothing more once %s', async (_, arrive) => {
    fakeTimeouts();

    await arrive();
    vi.advanceTimersByTime(10_000_000);

    expect(refreshes()).toHaveLength(1);
  });

  it('drops a token that cannot be decoded, rather than holding it', async () => {
    stop = startSession(store);
    expect(refreshes()).toHaveLength(1);

    await answerRefresh(0, { body: UNDECODABLE_TOKEN });

    await expect.poll(() => store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionStatusAtom)).toBe('signed-out');
    expect(store.get(sessionCheckedAtom)).toBe(true);
  });

  it('drops a token SSO hands back already expired, and warns about the clock', async () => {
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    stop = startSession(store);
    expect(refreshes()).toHaveLength(1);

    await answerRefresh(0, { body: fakeJwt(standardUser('staff'), -60) });

    await expect.poll(() => store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionStatusAtom)).toBe('signed-out');
    expect(store.get(sessionCheckedAtom)).toBe(true);
    expect(warned).toHaveBeenCalledTimes(1);
    expect(warned).toHaveBeenCalledWith(expect.stringMatching(/ahead of the server/));
  });

  it('treats a stored undecodable token as no token at bootstrap', async () => {
    store.set(odbTokenAtom, UNDECODABLE_TOKEN);

    stop = startSession(store);
    expect(refreshes()).toHaveLength(1);

    await answerRefresh(0, { status: 403 });

    expect(store.get(odbTokenAtom)).toBeNull();
  });

  it('signs the reader out when a refresh is rejected', async () => {
    holdToken(20);

    stop = startSession(store, FAST);
    await expectRefreshes(1);

    await answerRefresh(0, { status: 401 });

    expect(store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionCheckedAtom)).toBe(true);
  });

  it('refreshes a token past its deadline as soon as the tab is looked at again', async () => {
    holdToken(20);

    stop = startSession(store);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(refreshes()).toHaveLength(1);

    await answerRefresh(0, { status: 500 });

    document.dispatchEvent(new Event('visibilitychange'));

    expect(refreshes()).toHaveLength(1);
  });

  it('should arm nothing early when the token expires past the longest timer', () => {
    fakeTimeouts();
    const token = checkedToken(30 * 24 * 60 * 60);

    stop = startSession(store);

    vi.advanceTimersByTime(SESSION_TIMINGS.maxTimerMs - 1);
    expect(refreshes()).toHaveLength(0);
    expect(store.get(odbTokenAtom)).toBe(token);
  });

  it('refreshes at the longest timer and holds the token until its own expiry', async () => {
    const token = holdToken(2);

    stop = startSession(store, { ...FAST, refreshAheadMs: 10, maxTimerMs: 20 });

    await expectRefreshes(1);
    expect(store.get(odbTokenAtom)).toBe(token);

    await expect.poll(() => store.get(odbTokenAtom), { timeout: 3_000 }).toBeNull();
  });

  it('aborts the refresh it started when it is stopped, and changes nothing afterwards', async () => {
    const stopNow = startSession(store);
    const settled = pendingRefresh();
    const { signal } = call(0);

    stopNow();
    expect(signal?.aborted).toBe(true);

    call(0).answer({ body: fakeJwt(standardUser('staff')) });
    await settled;

    expect(store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionCheckedAtom)).toBe(false);
  });

  it('should keep the token over the refresh still in flight, and call the session checked, when a token arrives by another path', async () => {
    holdToken(20);
    stop = startSession(store);
    const settled = pendingRefresh();
    expect(refreshes()).toHaveLength(1);

    const guest = fakeJwt({ type: 'guest', id: 'u-guest' });
    store.set(odbTokenAtom, guest);

    expect(store.get(sessionStatusAtom)).toBe('signed-in');

    call(0).answer({ body: fakeJwt(standardUser('staff')) });
    await settled;

    expect(store.get(odbTokenAtom)).toBe(guest);
    expect(refreshes()).toHaveLength(1);
  });

  it('should keep the backoff the newer token waits on when the refresh that token aborted answers unreachable after it', async () => {
    fakeTimeouts();
    stop = startSession(store);
    await failRefresh(0);
    vi.advanceTimersByTime(SESSION_TIMINGS.minIntervalMs);
    const aborted = pendingRefresh();

    store.set(odbTokenAtom, fakeJwt({ type: 'guest', id: 'u-guest' }, 40));
    call(1).fail();
    await aborted;

    vi.advanceTimersByTime(SESSION_TIMINGS.minIntervalMs);
    expect(refreshes()).toHaveLength(3);
  });

  it("should take the newer refresh's answer and ask nothing more when the refresh a token aborted settles after it started", async () => {
    fakeTimeouts();
    stop = startSession(store);
    const aborted = pendingRefresh();
    store.set(odbTokenAtom, fakeJwt({ type: 'guest', id: 'u-guest' }, 40));
    vi.advanceTimersByTime(SESSION_TIMINGS.minIntervalMs);
    expect(refreshes()).toHaveLength(2);

    call(0).fail();
    await aborted;
    const token = fakeJwt(standardUser('staff'), 3600);
    await answerRefresh(1, { body: token });

    expect(store.get(odbTokenAtom)).toBe(token);
    vi.advanceTimersByTime(SESSION_TIMINGS.backoffCapMs);
    expect(refreshes()).toHaveLength(2);
  });

  it('settles and reports when a token subscriber throws, instead of rejecting the refresh', async () => {
    const reported = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    store.sub(odbTokenAtom, () => {
      throw new Error('a token subscriber failed');
    });

    stop = startSession(store, FAST);
    const token = fakeJwt(standardUser('staff'), 20);

    await answerRefresh(0, { body: token });

    expect(store.get(odbTokenAtom)).toBe(token);
    expect(store.get(sessionCheckedAtom)).toBe(true);
    expect(reported).toHaveBeenCalledTimes(1);

    await expectRefreshes(2);
  });

  it('leaves one live session when React mounts, unmounts and mounts again', async () => {
    const stopFirst = startSession(store);
    const first = pendingRefresh();
    stopFirst();

    stop = startSession(store);
    const second = pendingRefresh();

    expect(refreshes()).toHaveLength(2);
    expect(call(0).signal?.aborted).toBe(true);
    expect(call(1).signal?.aborted).toBe(false);

    const survivor = fakeJwt(standardUser('staff'));
    call(0).answer({ body: fakeJwt(standardUser('pi')) });
    call(1).answer({ body: survivor });
    await Promise.all([first, second]);

    expect(store.get(odbTokenAtom)).toBe(survivor);
    expect(refreshes()).toHaveLength(2);
  });

  it('drops a stored token that has already expired at once, and signs out when SSO will not renew it', async () => {
    holdToken(-60);

    stop = startSession(store);
    expect(refreshes()).toHaveLength(1);

    await expect.poll(() => store.get(odbTokenAtom)).toBeNull();

    await answerRefresh(0, { status: 403 });

    expect(store.get(sessionStatusAtom)).toBe('signed-out');
    expect(store.get(odbTokenAtom)).toBeNull();
  });

  it('drops a token once it expires while SSO is unreachable, and keeps asking on the backoff', async () => {
    holdToken(0.02);

    stop = startSession(store, FAST);
    await expectRefreshes(1);
    await answerRefresh(0, { status: 500 });

    await expect.poll(() => store.get(sessionStatusAtom)).toBe('signed-out');
    expect(store.get(odbTokenAtom)).toBeNull();

    await expectRefreshes(2);
    await answerRefresh(1, { status: 500 });

    await expectRefreshes(3);
    expect(store.get(odbTokenAtom)).toBeNull();
  });

  it('does not let a tab focus inside the backoff window pull the retry forward', async () => {
    // Only a moved clock can put the focus past the minimum interval yet inside the grown backoff.
    vi.useFakeTimers({ toFake: ['Date'] });
    holdToken(20);

    stop = startSession(store);
    document.dispatchEvent(new Event('visibilitychange'));
    await answerRefresh(0, { status: 500 });

    vi.setSystemTime(Date.now() + 30_000);
    document.dispatchEvent(new Event('visibilitychange'));
    await answerRefresh(1, { status: 500 });

    vi.setSystemTime(Date.now() + 31_000);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(refreshes()).toHaveLength(2);
  });

  it('should stay checking, then report signed-in once the refresh lands, when the token expires mid-refresh', async () => {
    holdToken(0.03);

    stop = startSession(store, FAST);
    expect(store.get(sessionStatusAtom)).toBe('checking');
    await expectRefreshes(1);

    await expect.poll(() => store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionStatusAtom)).toBe('checking');
    expect(refreshes()).toHaveLength(1);

    await answerRefresh(0, { body: fakeJwt(standardUser('staff')) });

    expect(store.get(sessionStatusAtom)).toBe('signed-in');
  });

  it('should report signed-out, then signed-in once the refresh lands, when the token of a checked tab expires mid-refresh', async () => {
    checkedToken(0.03);

    stop = startSession(store, { ...FAST, refreshAheadMs: 20 });
    expect(store.get(sessionStatusAtom)).toBe('signed-in');
    await expectRefreshes(1);

    await expect.poll(() => store.get(sessionStatusAtom)).toBe('signed-out');
    expect(store.get(odbTokenAtom)).toBeNull();
    expect(refreshes()).toHaveLength(1);

    await answerRefresh(0, { body: fakeJwt(standardUser('staff')) });

    expect(store.get(sessionStatusAtom)).toBe('signed-in');
  });

  it('leaves the token alone once stopped before it expires', () => {
    // Date moves with the timers here, or the expiry timer would find the token live and re-arm.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const token = holdToken(20);

    const stopNow = startSession(store);

    stopNow();
    vi.advanceTimersByTime(25_000);

    expect(store.get(odbTokenAtom)).toBe(token);
  });
});

describe(signOut, () => {
  it('discards a refresh already in flight when signOut runs, and arms no new timer once it lands', async () => {
    fakeTimeouts();
    holdToken(20);

    stop = startSession(store);
    document.dispatchEvent(new Event('visibilitychange'));
    const late = pendingRefresh();
    expect(refreshes()).toHaveLength(1);

    const signedOut = signOut(store);
    expect(store.get(odbTokenAtom)).toBeNull();

    call(0).answer({ body: fakeJwt(standardUser('pi')) });
    await late;
    ssoLogout().answer({ status: 200 });

    expect(await signedOut).toEqual({ reachedSso: true });
    expect(store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionCheckedAtom)).toBe(true);

    vi.advanceTimersByTime(10_000_000);
    expect(refreshes()).toHaveLength(1);
  });

  it('settles the session as signed out when the reader signs out mid-bootstrap', async () => {
    fakeTimeouts();
    stop = startSession(store);
    const bootstrap = pendingRefresh();
    expect(refreshes()).toHaveLength(1);

    const signedOut = signOut(store);
    ssoLogout().answer({ status: 200 });
    expect(await signedOut).toEqual({ reachedSso: true });

    call(0).answer({ body: fakeJwt(standardUser('staff')) });
    await bootstrap;

    expect(store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionCheckedAtom)).toBe(true);
    expect(store.get(sessionStatusAtom)).toBe('signed-out');

    vi.advanceTimersByTime(200_000);
    expect(refreshes()).toHaveLength(1);
  });

  it('still signs the reader out here when SSO refuses the logout', async () => {
    stop = startSession(store);
    await answerRefresh(0, { status: 403 });

    const signedOut = signOut(store);
    ssoLogout().answer({ status: 500, body: 'no session' });

    expect(await signedOut).toEqual({ reachedSso: false });
    expect(store.get(odbTokenAtom)).toBeNull();
  });

  it('still resolves and posts the logout when a token subscriber throws', async () => {
    const reported = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    holdToken();
    stop = startSession(store);

    store.sub(odbTokenAtom, () => {
      throw new Error('a token subscriber failed');
    });

    const signedOut = signOut(store);
    ssoLogout().answer({ status: 200 });

    expect(await signedOut).toEqual({ reachedSso: true });
    expect(store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionCheckedAtom)).toBe(true);
    expect(reported).toHaveBeenCalledTimes(1);
  });

  it('should keep the reader signed out when the tab is looked at again after a failed logout', async () => {
    fakeTimeouts();
    checkedToken(20);

    stop = startSession(store);

    const signedOut = signOut(store);
    ssoLogout().answer({ status: 500 });
    expect(await signedOut).toEqual({ reachedSso: false });

    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(10_000_000);

    expect(refreshes()).toHaveLength(0);
    expect(store.get(odbTokenAtom)).toBeNull();
  });

  it('tells every other tab before it asks SSO, so they sign out even when the logout fails', async () => {
    holdToken();
    stop = startSession(store);
    const announced = new Promise<unknown>((resolve) => {
      otherTab.addEventListener('message', (event) => resolve(event.data), { once: true });
    });

    const signedOut = signOut(store);
    expect(await announced).toBe(SIGNED_OUT_MESSAGE);
    ssoLogout().answer({ status: 500 });

    expect(await signedOut).toEqual({ reachedSso: false });
  });

  it('should tell the other tabs again, for one that loaded while it was still logging out, when SSO answers', async () => {
    holdToken();
    stop = startSession(store);
    const heard: unknown[] = [];
    otherTab.addEventListener('message', (event) => heard.push(event.data));

    const signedOut = signOut(store);
    await expect.poll(() => heard).toEqual([SIGNED_OUT_MESSAGE]);
    ssoLogout().answer({ status: 500 });
    await signedOut;

    await expect.poll(() => heard).toEqual([SIGNED_OUT_MESSAGE, SIGNED_OUT_MESSAGE]);
  });

  it('should leave a guest who signed in during the logout alone when the late announcement goes out', async () => {
    holdToken();
    stop = startSession(store);
    const signedOut = signOut(store);
    const guest = fakeJwt({ type: 'guest', id: 'u-guest' });
    store.set(odbTokenAtom, guest);

    ssoLogout().answer({ status: 200 });
    await signedOut;
    await announceFromOtherTab('probe');

    expect(store.get(odbTokenAtom)).toBe(guest);
    expect(store.get(sessionStatusAtom)).toBe('signed-in');
  });

  it('posts no late announcement when no keeper was running to announce the first', async () => {
    const stopNow = startSession(store);
    stopNow();
    const heard = vi.fn();
    otherTab.addEventListener('message', heard);

    const signedOut = signOut(store);
    ssoLogout().answer({ status: 200 });
    await signedOut;
    await announceFromOtherTab('probe');

    expect(heard).not.toHaveBeenCalled();
  });

  describe('a reader who signed out and signed in again', () => {
    const signOutThenSignInAgain = async (expiresInSeconds?: number): Promise<void> => {
      checkedToken();
      stop = startSession(store);
      const signedOut = signOut(store);
      ssoLogout().answer({ status: 200 });
      await signedOut;
      setToken(store, fakeJwt({ type: 'guest', id: 'u-guest' }, expiresInSeconds));
    };

    it('should still refresh the new token when it reaches its refresh-ahead mark', async () => {
      fakeTimeouts();
      await signOutThenSignInAgain(120);

      vi.advanceTimersByTime(89_000);
      expect(refreshes()).toHaveLength(0);

      vi.advanceTimersByTime(1_000);
      expect(refreshes()).toHaveLength(1);
    });

    it('should still tell the other tabs when the reader signs out a second time', async () => {
      await signOutThenSignInAgain();
      await announceFromOtherTab('probe');
      const heard: unknown[] = [];
      otherTab.addEventListener('message', (event) => heard.push(event.data));

      void signOut(store);

      await expect.poll(() => heard).toEqual([SIGNED_OUT_MESSAGE]);
    });

    it('should still sign out and record it when another tab logs out', async () => {
      await signOutThenSignInAgain();

      await announceFromOtherTab(SIGNED_OUT_MESSAGE);

      expect(store.get(odbTokenAtom)).toBeNull();
      expect(store.get(sessionEndingAtom)).toBe('logged-out-elsewhere');
    });
  });
});

describe('a logout in another tab', () => {
  const signedInHere = (): string => {
    const token = checkedToken();
    stop = startSession(store);
    return token;
  };

  it('signs this tab out without asking SSO, since the tab that pressed Logout already did', async () => {
    signedInHere();

    await announceFromOtherTab(SIGNED_OUT_MESSAGE);

    expect(store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionStatusAtom)).toBe('signed-out');
    expect(ssoCalls()).toHaveLength(0);
  });

  it('stays signed out when the tab is looked at again long after, while the SSO cookie may still exist', async () => {
    fakeTimeouts();
    signedInHere();

    await announceFromOtherTab(SIGNED_OUT_MESSAGE);
    expect(store.get(odbTokenAtom)).toBeNull();

    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(10_000_000);

    expect(refreshes()).toHaveLength(0);
    expect(store.get(sessionStatusAtom)).toBe('signed-out');
  });

  it('changes nothing in a tab that is already signed out, and asks SSO nothing', async () => {
    stop = startSession(store);
    await answerRefresh(0, { status: 403 });
    const changed = vi.fn();
    const unsubscribe = store.sub(sessionStatusAtom, changed);

    try {
      await announceFromOtherTab(SIGNED_OUT_MESSAGE);

      expect(changed).not.toHaveBeenCalled();
      expect(store.get(sessionStatusAtom)).toBe('signed-out');
      expect(ssoCalls()).toHaveLength(1);
    } finally {
      unsubscribe();
    }
  });

  it('should keep listening, so a guest who signs in here is signed out again, when another tab has already ended the session once', async () => {
    const token = signedInHere();

    await announceFromOtherTab(SIGNED_OUT_MESSAGE);
    expect(store.get(odbTokenAtom)).toBeNull();

    store.set(odbTokenAtom, token);
    await announceFromOtherTab(SIGNED_OUT_MESSAGE);

    expect(store.get(odbTokenAtom)).toBeNull();
  });

  it('should leave no listener behind when a keeper is started again over a running one', () => {
    checkedToken(20);
    startSession(store);
    stop = startSession(store);

    document.dispatchEvent(new Event('visibilitychange'));

    expect(refreshes()).toHaveLength(1);
  });

  it('ignores any other message on the channel', async () => {
    const token = signedInHere();

    for (const noise of ['signed-in', { type: SIGNED_OUT_MESSAGE }, null, 42]) {
      await announceFromOtherTab(noise);
    }

    expect(store.get(odbTokenAtom)).toBe(token);
    expect(ssoCalls()).toHaveLength(0);
  });

  it('still tears the keeper down when a token subscriber throws', async () => {
    const reported = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    signedInHere();
    store.sub(odbTokenAtom, () => {
      throw new Error('a token subscriber failed');
    });

    await announceFromOtherTab(SIGNED_OUT_MESSAGE);
    expect(store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionCheckedAtom)).toBe(true);
    expect(reported).toHaveBeenCalledTimes(1);
  });
});

describe('how the session ended', () => {
  it('should record a lapse when SSO refuses to renew a session the gate had opened', async () => {
    checkedToken(20);
    stop = startSession(store, FAST);
    await expectRefreshes(1);

    await answerRefresh(0, { status: 403 });

    expect(store.get(sessionEndingAtom)).toBe('lapsed');
  });

  it('should record a lapse when the token of a session the gate had opened expires', async () => {
    checkedToken(0.03);
    stop = startSession(store, { ...FAST, refreshAheadMs: 20 });
    await expectRefreshes(1);

    await expect.poll(() => store.get(odbTokenAtom)).toBeNull();

    expect(store.get(sessionEndingAtom)).toBe('lapsed');
  });

  it('should record a logout in another tab when it ends a session the gate had opened', async () => {
    checkedToken();
    stop = startSession(store);

    await announceFromOtherTab(SIGNED_OUT_MESSAGE);

    expect(store.get(sessionEndingAtom)).toBe('logged-out-elsewhere');
  });

  it('should record nothing when SSO refuses a stored token before the gate opened', async () => {
    holdToken();
    stop = startSession(store);

    await answerRefresh(0, { status: 403 });

    expect(store.get(sessionStatusAtom)).toBe('signed-out');
    expect(store.get(sessionEndingAtom)).toBe('none');
  });

  it('should record nothing when a stored token expires before the gate opened', async () => {
    holdToken(0.02);
    stop = startSession(store);

    await expect.poll(() => store.get(odbTokenAtom)).toBeNull();

    expect(store.get(sessionEndingAtom)).toBe('none');
  });

  it('should record nothing when another tab logs out before the gate opened', async () => {
    holdToken();
    stop = startSession(store);

    await announceFromOtherTab(SIGNED_OUT_MESSAGE);

    expect(store.get(sessionStatusAtom)).toBe('signed-out');
    expect(store.get(sessionEndingAtom)).toBe('none');
  });

  it('should keep the lapse when another tab logs out after the session already ended', async () => {
    checkedToken();
    stop = startSession(store);
    setToken(store, null);

    await announceFromOtherTab(SIGNED_OUT_MESSAGE);

    expect(store.get(sessionEndingAtom)).toBe('lapsed');
  });

  it.each([
    ['reaches SSO', 200, 'logged-out'],
    ['misses SSO', 500, 'logout-missed-sso'],
  ] as const)(
    'should record a logout in flight, then one that %s, when the reader signs out',
    async (_, status, ending) => {
      checkedToken();
      stop = startSession(store);

      const signedOut = signOut(store);
      expect(store.get(sessionEndingAtom)).toBe('logging-out');

      ssoLogout().answer({ status });
      await signedOut;

      expect(store.get(sessionEndingAtom)).toBe(ending);
    },
  );
});
