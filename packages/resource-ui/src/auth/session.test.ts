import { fakeJwt, standardUser } from '@gemini-hlsw/lucuma-common-ui/testing';
import { createStore, type Store } from 'jotai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isLoggedInAtom, odbTokenAtom, sessionCheckedAtom, sessionStatusAtom } from '@/components/atoms/auth';
import { fakeTimeouts, UNDECODABLE_TOKEN } from '@/test/helpers';
import { answerRefresh, ssoCall as call, ssoCalls, ssoLogout, ssoRefreshes as refreshes, stubSso } from '@/test/sso';

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
  it('should mark the session checked on the store it was started with when that store holds a token', () => {
    const other = createStore();
    holdToken();

    stop = startSession(store);

    expect(store.get(sessionCheckedAtom)).toBe(true);
    expect(other.get(sessionCheckedAtom)).toBe(false);
  });

  it('should sign the reader in from the SSO session cookie when a reader returns', async () => {
    stop = startSession(store);
    expect(refreshes()).toHaveLength(1);

    const token = fakeJwt(standardUser('staff'));
    await answerRefresh(0, { body: token });

    expect(store.get(odbTokenAtom)).toBe(token);
    expect(store.get(isLoggedInAtom)).toBe(true);
    expect(store.get(sessionCheckedAtom)).toBe(true);
  });

  it('should leave the visitor signed out and say the question was asked when SSO finds no session', async () => {
    stop = startSession(store);

    await answerRefresh(0, { status: 403 });

    expect(store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionCheckedAtom)).toBe(true);
  });

  it('should ask SSO nothing when the stored token is still good', () => {
    const token = holdToken();

    stop = startSession(store);

    expect(ssoCalls()).toHaveLength(0);
    expect(store.get(sessionCheckedAtom)).toBe(true);
    expect(store.get(odbTokenAtom)).toBe(token);
  });

  it('should refresh when the token reaches its own refresh deadline', async () => {
    holdToken(0.1);

    stop = startSession(store, { ...FAST, refreshAheadMs: 60 });
    expect(refreshes()).toHaveLength(0);

    await expectRefreshes(1);
  });

  it('should ask nothing when the token has not reached its own refresh deadline', () => {
    fakeTimeouts();
    holdToken(120);

    stop = startSession(store);

    vi.advanceTimersByTime(89_000);
    expect(refreshes()).toHaveLength(0);
  });

  it('should ask nothing, from a refocus or its own timer, when still inside the minimum interval after an answer', async () => {
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

  it('should ask again once the minimum interval passes when the fresh token expires at the same time as the old one', async () => {
    const token = holdToken(20);

    stop = startSession(store, FAST);
    await expectRefreshes(1);

    await answerRefresh(0, { body: token });

    await expectRefreshes(2);
  });

  it('should keep one in-flight refresh when a second trigger crosses the retry floor before it lands', async () => {
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
    'should ask again after the backoff when SSO cannot be reached while holding %s',
    async (holding) => {
      const token = holding === 'no token' ? null : fakeJwt(standardUser('staff'), 20);
      store.set(odbTokenAtom, token);

      stop = startSession(store, FAST);
      await expectRefreshes(1);

      await answerRefresh(0, { status: 500 });

      expect(store.get(odbTokenAtom)).toBe(token);
      expect(store.get(sessionCheckedAtom)).toBe(true);

      await expectRefreshes(2);
    },
  );

  it('should double the backoff, up to a cap, when each answer finds SSO unreachable', async () => {
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

  it('should reset the backoff rather than keep the wait it grew to when a refresh finally succeeds', async () => {
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
  ])('should ask SSO nothing more when %s', async (_, arrive) => {
    fakeTimeouts();

    await arrive();
    vi.advanceTimersByTime(10_000_000);

    expect(refreshes()).toHaveLength(1);
  });

  it('should drop the token rather than hold it when it cannot be decoded', async () => {
    stop = startSession(store);
    expect(refreshes()).toHaveLength(1);

    await answerRefresh(0, { body: UNDECODABLE_TOKEN });

    await expect.poll(() => store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionStatusAtom)).toBe('signed-out');
    expect(store.get(sessionCheckedAtom)).toBe(true);
  });

  it('should drop the token and warn about the clock when SSO hands it back already expired', async () => {
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

  it('should treat the stored token as no token when it cannot be decoded at bootstrap', async () => {
    store.set(odbTokenAtom, UNDECODABLE_TOKEN);

    stop = startSession(store);
    expect(refreshes()).toHaveLength(1);

    await answerRefresh(0, { status: 403 });

    expect(store.get(odbTokenAtom)).toBeNull();
  });

  it('should sign the reader out when a refresh is rejected', async () => {
    holdToken(20);

    stop = startSession(store, FAST);
    await expectRefreshes(1);

    await answerRefresh(0, { status: 401 });

    expect(store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionCheckedAtom)).toBe(true);
  });

  it('should refresh a token past its deadline at once when the tab is looked at again', async () => {
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
    const token = holdToken(30 * 24 * 60 * 60);

    stop = startSession(store);

    vi.advanceTimersByTime(SESSION_TIMINGS.maxTimerMs - 1);
    expect(refreshes()).toHaveLength(0);
    expect(store.get(odbTokenAtom)).toBe(token);
  });

  it('should refresh at the longest timer and hold the token until its own expiry when the token expires past the longest timer', async () => {
    const token = holdToken(2);

    stop = startSession(store, { ...FAST, refreshAheadMs: 10, maxTimerMs: 20 });

    await expectRefreshes(1);
    expect(store.get(odbTokenAtom)).toBe(token);

    await expect.poll(() => store.get(odbTokenAtom), { timeout: 3_000 }).toBeNull();
  });

  it('should abort the refresh it started and change nothing afterwards when it is stopped', async () => {
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

  it('should settle and report instead of rejecting the refresh when a token subscriber throws', async () => {
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

  it('should leave one live session when React mounts, unmounts and mounts again', async () => {
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

  it('should drop the stored token at once, then sign out once SSO will not renew it, when the token has already expired', async () => {
    holdToken(-60);

    stop = startSession(store);
    expect(refreshes()).toHaveLength(1);

    await expect.poll(() => store.get(odbTokenAtom)).toBeNull();

    await answerRefresh(0, { status: 403 });

    expect(store.get(sessionStatusAtom)).toBe('signed-out');
    expect(store.get(odbTokenAtom)).toBeNull();
  });

  it('should drop the token and keep asking on the backoff when it expires while SSO is unreachable', async () => {
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

  it('should not pull the retry forward when the tab gains focus inside the backoff window', async () => {
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

  it('should report signed-out, then signed-in once the refresh lands, when the token expires mid-refresh', async () => {
    holdToken(0.03);

    stop = startSession(store, FAST);
    expect(store.get(sessionStatusAtom)).toBe('signed-in');
    await expectRefreshes(1);

    await expect.poll(() => store.get(sessionStatusAtom)).toBe('signed-out');
    expect(store.get(odbTokenAtom)).toBeNull();
    expect(refreshes()).toHaveLength(1);

    await answerRefresh(0, { body: fakeJwt(standardUser('staff')) });

    expect(store.get(sessionStatusAtom)).toBe('signed-in');
  });

  it('should leave the token alone when stopped before it expires', () => {
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
  it('should discard a refresh already in flight, arming no new timer once it lands, when signOut runs', async () => {
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

  it('should settle the session as signed out when the reader signs out mid-bootstrap', async () => {
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

  it('should still sign the reader out here when SSO refuses the logout', async () => {
    stop = startSession(store);
    await answerRefresh(0, { status: 403 });

    const signedOut = signOut(store);
    ssoLogout().answer({ status: 500, body: 'no session' });

    expect(await signedOut).toEqual({ reachedSso: false });
    expect(store.get(odbTokenAtom)).toBeNull();
  });

  it('should still resolve and post the logout when a token subscriber throws', async () => {
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
    holdToken(20);

    stop = startSession(store);

    const signedOut = signOut(store);
    ssoLogout().answer({ status: 500 });
    expect(await signedOut).toEqual({ reachedSso: false });

    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(10_000_000);

    expect(refreshes()).toHaveLength(0);
    expect(store.get(odbTokenAtom)).toBeNull();
  });

  it('should tell every other tab before it asks SSO, so they sign out, even when the logout fails', async () => {
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

  it('should sign out a tab that loaded during the logout when SSO answers', async () => {
    holdToken();
    stop = startSession(store);
    const signedOut = signOut(store);

    stop = startSession(store);
    const bootstrap = pendingRefresh();
    const witness = new BroadcastChannel(SESSION_CHANNEL);
    const lateAnnouncement = new Promise<void>((resolve) => {
      witness.addEventListener('message', () => resolve(), { once: true });
    });
    ssoLogout().answer({ status: 500 });
    await signedOut;
    await lateAnnouncement;
    witness.close();

    expect(refreshes()[0]?.signal?.aborted).toBe(true);
    refreshes()[0]?.answer({ body: fakeJwt(standardUser('staff')) });
    await bootstrap;
    expect(store.get(sessionStatusAtom)).toBe('signed-out');
  });

  it('should post no late announcement when no keeper was running to announce the first', async () => {
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
});

describe('a logout in another tab', () => {
  const signedInHere = (): string => {
    const token = holdToken();
    stop = startSession(store);
    return token;
  };

  it('should sign this tab out without asking SSO, since the tab that pressed Logout already did, when another tab logs out', async () => {
    signedInHere();

    await announceFromOtherTab(SIGNED_OUT_MESSAGE);

    expect(store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionStatusAtom)).toBe('signed-out');
    expect(ssoCalls()).toHaveLength(0);
  });

  it('should stay signed out, though the SSO cookie may still exist, when the tab is looked at again long after', async () => {
    fakeTimeouts();
    signedInHere();

    await announceFromOtherTab(SIGNED_OUT_MESSAGE);
    expect(store.get(odbTokenAtom)).toBeNull();

    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(10_000_000);

    expect(refreshes()).toHaveLength(0);
    expect(store.get(sessionStatusAtom)).toBe('signed-out');
  });

  it('should change nothing and ask SSO nothing when the tab is already signed out', async () => {
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

  it('should leave no channel open when a keeper is started again over a running one', async () => {
    startSession(store);
    stop = startSession(store);
    const token = holdToken();

    await announceFromOtherTab(SIGNED_OUT_MESSAGE);
    expect(store.get(odbTokenAtom)).toBeNull();

    store.set(odbTokenAtom, token);
    await announceFromOtherTab(SIGNED_OUT_MESSAGE);

    expect(store.get(odbTokenAtom)).toBe(token);
  });

  it('should ignore the message when any other message arrives on the channel', async () => {
    const token = signedInHere();

    for (const noise of ['signed-in', { type: SIGNED_OUT_MESSAGE }, null, 42]) {
      await announceFromOtherTab(noise);
    }

    expect(store.get(odbTokenAtom)).toBe(token);
    expect(ssoCalls()).toHaveLength(0);
  });

  it('should still tear the keeper down when a token subscriber throws', async () => {
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
