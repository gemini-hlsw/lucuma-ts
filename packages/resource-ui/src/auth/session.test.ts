import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isLoggedInAtom, odbTokenAtom, sessionCheckedAtom, sessionStatusAtom } from '@/components/atoms/auth';
import { store } from '@/components/atoms/store';
import { fakeJwt, standardUser } from '@/test/factories';
import {
  type PendingSsoCall,
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

let stop: (() => void) | undefined;
let otherTab: BroadcastChannel;

const fakeTimeouts = (): void => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
};

async function expectRefreshes(count: number): Promise<void> {
  await expect.poll(() => refreshes(), { interval: 1 }).toHaveLength(count);
}

async function answerRefresh(index: number, response: Parameters<PendingSsoCall['answer']>[0]): Promise<void> {
  const settled = pendingRefresh();
  call(index).answer(response);
  await settled;
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
  it('signs a returning reader in from the SSO session cookie', async () => {
    stop = startSession();
    expect(refreshes()).toHaveLength(1);

    const token = fakeJwt(standardUser('staff'));
    await answerRefresh(0, { body: token });

    expect(store.get(odbTokenAtom)).toBe(token);
    expect(store.get(isLoggedInAtom)).toBe(true);
    expect(store.get(sessionCheckedAtom)).toBe(true);
  });

  it('leaves a visitor signed out, and says the question was asked', async () => {
    stop = startSession();

    await answerRefresh(0, { status: 403 });

    expect(store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionCheckedAtom)).toBe(true);
  });

  it('asks SSO nothing when the stored token is still good', () => {
    const token = fakeJwt(standardUser('staff'));
    store.set(odbTokenAtom, token);

    stop = startSession();

    expect(ssoCalls()).toHaveLength(0);
    expect(store.get(sessionCheckedAtom)).toBe(true);
    expect(store.get(odbTokenAtom)).toBe(token);
  });

  it('refreshes once the token reaches its own refresh deadline', async () => {
    store.set(odbTokenAtom, fakeJwt(standardUser('staff'), 0.1));

    stop = startSession({ ...FAST, refreshAheadMs: 60 });
    expect(refreshes()).toHaveLength(0);

    await expectRefreshes(1);
  });

  it('asks nothing before the token own refresh deadline', () => {
    fakeTimeouts();
    store.set(odbTokenAtom, fakeJwt(standardUser('staff'), 120));

    stop = startSession();

    vi.advanceTimersByTime(89_000);
    expect(refreshes()).toHaveLength(0);
  });

  it('asks nothing inside the minimum interval after an answer, from a refocus or its own timer', async () => {
    fakeTimeouts();
    store.set(odbTokenAtom, fakeJwt(standardUser('staff'), 20));

    stop = startSession();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(refreshes()).toHaveLength(1);

    await answerRefresh(0, { body: fakeJwt(standardUser('staff'), 20) });

    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(29_000);
    expect(refreshes()).toHaveLength(1);
  });

  it('asks again once the minimum interval passes when the fresh token expires when the old one did', async () => {
    const token = fakeJwt(standardUser('staff'), 20);
    store.set(odbTokenAtom, token);

    stop = startSession(FAST);
    await expectRefreshes(1);

    await answerRefresh(0, { body: token });

    await expectRefreshes(2);
  });

  it('keeps one in-flight refresh when a second trigger crosses the retry floor before it lands', async () => {
    store.set(odbTokenAtom, fakeJwt(standardUser('staff'), 20));

    stop = startSession({ ...SESSION_TIMINGS, minIntervalMs: 0 });
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
    'asks again after the backoff when SSO cannot be reached, holding %s',
    async (holding) => {
      const token = holding === 'no token' ? null : fakeJwt(standardUser('staff'), 20);
      store.set(odbTokenAtom, token);

      stop = startSession(FAST);
      await expectRefreshes(1);

      await answerRefresh(0, { status: 500 });

      expect(store.get(odbTokenAtom)).toBe(token);
      expect(store.get(sessionCheckedAtom)).toBe(true);

      await expectRefreshes(2);
    },
  );

  it('doubles the backoff on each unreachable answer and caps it', async () => {
    const expectedDelaysMs = [10, 20, 40, 40, 40, 40];
    const waitedMs: number[] = [];

    stop = startSession(FAST);
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
    stop = startSession({ ...FAST, backoffCapMs: 1_000 });
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
        stop = startSession();
        await answerRefresh(0, { status: 403 });
      },
    ],
    [
      'SSO rejects the refresh of a held token',
      async () => {
        store.set(odbTokenAtom, fakeJwt(standardUser('staff'), 20));
        stop = startSession();
        document.dispatchEvent(new Event('visibilitychange'));
        await answerRefresh(0, { status: 401 });
      },
    ],
    [
      'SSO hands back a token that cannot be decoded',
      async () => {
        stop = startSession();
        await answerRefresh(0, { body: 'header.payload.signature' });
      },
    ],
    [
      'SSO hands back a token already expired',
      async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        stop = startSession();
        await answerRefresh(0, { body: fakeJwt(standardUser('staff'), -60) });
      },
    ],
    [
      'SSO will not renew a stored token that has already expired',
      async () => {
        store.set(odbTokenAtom, fakeJwt(standardUser('staff'), -60));
        stop = startSession();
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
    stop = startSession();
    expect(refreshes()).toHaveLength(1);

    await answerRefresh(0, { body: 'header.payload.signature' });

    await expect.poll(() => store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionStatusAtom)).toBe('signed-out');
    expect(store.get(sessionCheckedAtom)).toBe(true);
  });

  it('drops a token SSO hands back already expired, and warns about the clock', async () => {
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    stop = startSession();
    expect(refreshes()).toHaveLength(1);

    await answerRefresh(0, { body: fakeJwt(standardUser('staff'), -60) });

    await expect.poll(() => store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionStatusAtom)).toBe('signed-out');
    expect(store.get(sessionCheckedAtom)).toBe(true);
    expect(warned).toHaveBeenCalledTimes(1);
    expect(warned).toHaveBeenCalledWith(expect.stringMatching(/ahead of the server/));
  });

  it('treats a stored undecodable token as no token at bootstrap', async () => {
    store.set(odbTokenAtom, 'header.payload.signature');

    stop = startSession();
    expect(refreshes()).toHaveLength(1);

    await answerRefresh(0, { status: 403 });

    expect(store.get(odbTokenAtom)).toBeNull();
  });

  it('signs the reader out when a refresh is rejected', async () => {
    store.set(odbTokenAtom, fakeJwt(standardUser('staff'), 20));

    stop = startSession(FAST);
    await expectRefreshes(1);

    await answerRefresh(0, { status: 401 });

    expect(store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionCheckedAtom)).toBe(true);
  });

  it('refreshes a token past its deadline as soon as the tab is looked at again', async () => {
    store.set(odbTokenAtom, fakeJwt(standardUser('staff'), 20));

    stop = startSession();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(refreshes()).toHaveLength(1);

    await answerRefresh(0, { status: 500 });

    document.dispatchEvent(new Event('visibilitychange'));

    expect(refreshes()).toHaveLength(1);
  });

  it('arms nothing early for a token that expires past the longest timer', () => {
    fakeTimeouts();
    const token = fakeJwt(standardUser('staff'), 30 * 24 * 60 * 60);
    store.set(odbTokenAtom, token);

    stop = startSession();

    vi.advanceTimersByTime(SESSION_TIMINGS.maxTimerMs - 1);
    expect(refreshes()).toHaveLength(0);
    expect(store.get(odbTokenAtom)).toBe(token);
  });

  it('refreshes at the longest timer and holds the token until its own expiry', async () => {
    const token = fakeJwt(standardUser('staff'), 2);
    store.set(odbTokenAtom, token);

    stop = startSession({ ...FAST, refreshAheadMs: 10, maxTimerMs: 20 });

    await expectRefreshes(1);
    expect(store.get(odbTokenAtom)).toBe(token);

    await expect.poll(() => store.get(odbTokenAtom), { timeout: 3_000 }).toBeNull();
  });

  it('aborts the refresh it started when it is stopped, and changes nothing afterwards', async () => {
    const stopNow = startSession();
    const settled = pendingRefresh();
    const { signal } = call(0);

    stopNow();
    expect(signal?.aborted).toBe(true);

    call(0).answer({ body: fakeJwt(standardUser('staff')) });
    await settled;

    expect(store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionCheckedAtom)).toBe(false);
  });

  it('settles and reports when a token subscriber throws, instead of rejecting the refresh', async () => {
    const reported = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const unsubscribe = store.sub(odbTokenAtom, () => {
      throw new Error('a token subscriber failed');
    });

    try {
      stop = startSession(FAST);
      const token = fakeJwt(standardUser('staff'), 20);

      await answerRefresh(0, { body: token });

      expect(store.get(odbTokenAtom)).toBe(token);
      expect(store.get(sessionCheckedAtom)).toBe(true);
      expect(reported).toHaveBeenCalledTimes(1);

      await expectRefreshes(2);
    } finally {
      unsubscribe();
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

    const survivor = fakeJwt(standardUser('staff'));
    call(0).answer({ body: fakeJwt(standardUser('pi')) });
    call(1).answer({ body: survivor });
    await Promise.all([first, second]);

    expect(store.get(odbTokenAtom)).toBe(survivor);
    expect(refreshes()).toHaveLength(2);
  });

  it('drops a stored token that has already expired at once, and signs out when SSO will not renew it', async () => {
    store.set(odbTokenAtom, fakeJwt(standardUser('staff'), -60));

    stop = startSession();
    expect(refreshes()).toHaveLength(1);

    await expect.poll(() => store.get(odbTokenAtom)).toBeNull();

    await answerRefresh(0, { status: 403 });

    expect(store.get(sessionStatusAtom)).toBe('signed-out');
    expect(store.get(odbTokenAtom)).toBeNull();
  });

  it('drops a token once it expires while SSO is unreachable, and keeps asking on the backoff', async () => {
    store.set(odbTokenAtom, fakeJwt(standardUser('staff'), 0.02));

    stop = startSession(FAST);
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
    store.set(odbTokenAtom, fakeJwt(standardUser('staff'), 20));

    stop = startSession();
    document.dispatchEvent(new Event('visibilitychange'));
    await answerRefresh(0, { status: 500 });

    vi.setSystemTime(Date.now() + 30_000);
    document.dispatchEvent(new Event('visibilitychange'));
    await answerRefresh(1, { status: 500 });

    vi.setSystemTime(Date.now() + 31_000);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(refreshes()).toHaveLength(2);
  });

  it('reports signed-out once the token expires mid-refresh, and signed-in again when the refresh lands', async () => {
    store.set(odbTokenAtom, fakeJwt(standardUser('staff'), 0.03));

    stop = startSession(FAST);
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
    const token = fakeJwt(standardUser('staff'), 20);
    store.set(odbTokenAtom, token);

    const stopNow = startSession();

    stopNow();
    vi.advanceTimersByTime(25_000);

    expect(store.get(odbTokenAtom)).toBe(token);
  });
});

describe(signOut, () => {
  it('discards a refresh already in flight when signOut runs, and arms no new timer once it lands', async () => {
    fakeTimeouts();
    store.set(odbTokenAtom, fakeJwt(standardUser('staff'), 20));

    stop = startSession();
    document.dispatchEvent(new Event('visibilitychange'));
    const late = pendingRefresh();
    expect(refreshes()).toHaveLength(1);

    const signedOut = signOut();
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
    stop = startSession();
    const bootstrap = pendingRefresh();
    expect(refreshes()).toHaveLength(1);

    const signedOut = signOut();
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
    stop = startSession();
    await answerRefresh(0, { status: 403 });

    const signedOut = signOut();
    ssoLogout().answer({ status: 500, body: 'no session' });

    expect(await signedOut).toEqual({ reachedSso: false });
    expect(store.get(odbTokenAtom)).toBeNull();
  });

  it('still resolves and posts the logout when a token subscriber throws', async () => {
    const reported = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    store.set(odbTokenAtom, fakeJwt(standardUser('staff')));
    stop = startSession();

    const unsubscribe = store.sub(odbTokenAtom, () => {
      throw new Error('a token subscriber failed');
    });

    try {
      const signedOut = signOut();
      ssoLogout().answer({ status: 200 });

      expect(await signedOut).toEqual({ reachedSso: true });
      expect(store.get(odbTokenAtom)).toBeNull();
      expect(store.get(sessionCheckedAtom)).toBe(true);
      expect(reported).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });

  it('keeps the reader signed out when the tab is looked at again after a failed logout', async () => {
    fakeTimeouts();
    store.set(odbTokenAtom, fakeJwt(standardUser('staff'), 20));

    stop = startSession();

    const signedOut = signOut();
    ssoLogout().answer({ status: 500 });
    expect(await signedOut).toEqual({ reachedSso: false });

    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(10_000_000);

    expect(refreshes()).toHaveLength(0);
    expect(store.get(odbTokenAtom)).toBeNull();
  });

  it('tells every other tab before it asks SSO, so they sign out even when the logout fails', async () => {
    store.set(odbTokenAtom, fakeJwt(standardUser('staff')));
    stop = startSession();
    const announced = new Promise<unknown>((resolve) => {
      otherTab.addEventListener('message', (event) => resolve(event.data), { once: true });
    });

    const signedOut = signOut();
    expect(await announced).toBe(SIGNED_OUT_MESSAGE);
    ssoLogout().answer({ status: 500 });

    expect(await signedOut).toEqual({ reachedSso: false });
  });

  it('signs out a tab that loaded while SSO was still logging out', async () => {
    store.set(odbTokenAtom, fakeJwt(standardUser('staff')));
    stop = startSession();
    const signedOut = signOut();

    stop = startSession();
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

  it('posts no late announcement when no keeper was running to announce the first', async () => {
    const stopNow = startSession();
    stopNow();
    const heard = vi.fn();
    otherTab.addEventListener('message', heard);

    const signedOut = signOut();
    ssoLogout().answer({ status: 200 });
    await signedOut;
    await announceFromOtherTab('probe');

    expect(heard).not.toHaveBeenCalled();
  });
});

describe('a logout in another tab', () => {
  const signedInHere = (): string => {
    const token = fakeJwt(standardUser('staff'));
    store.set(odbTokenAtom, token);
    stop = startSession();
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
    stop = startSession();
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

  it('leaves no channel open from a keeper started again over a running one', async () => {
    startSession();
    stop = startSession();
    const token = fakeJwt(standardUser('staff'));
    store.set(odbTokenAtom, token);

    await announceFromOtherTab(SIGNED_OUT_MESSAGE);
    expect(store.get(odbTokenAtom)).toBeNull();

    store.set(odbTokenAtom, token);
    await announceFromOtherTab(SIGNED_OUT_MESSAGE);

    expect(store.get(odbTokenAtom)).toBe(token);
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
    const unsubscribe = store.sub(odbTokenAtom, () => {
      throw new Error('a token subscriber failed');
    });

    try {
      await announceFromOtherTab(SIGNED_OUT_MESSAGE);
      expect(store.get(odbTokenAtom)).toBeNull();
      expect(store.get(sessionCheckedAtom)).toBe(true);
      expect(reported).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });
});
