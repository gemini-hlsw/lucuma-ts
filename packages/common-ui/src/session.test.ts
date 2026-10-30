import { createStore, type Store } from 'jotai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isLoggedInAtom,
  odbTokenAtom,
  sessionCheckedAtom,
  sessionStatusAtom,
  setToken,
  signedOutElsewhereAtom,
  useSessionStatus,
} from './atoms.ts';
import type { StandardRole } from './auth.ts';
import {
  createSession,
  planRoleSwitch,
  type RoleSwitchOutcome,
  type Session,
  SESSION_TIMINGS,
  sessionPerStore,
  type SessionTimings,
  SIGNED_OUT_MESSAGE,
} from './session.ts';
import { REFRESH_TIMEOUT_MS } from './sso.ts';
import {
  type PendingSsoCall,
  ssoCall as call,
  ssoCalls,
  ssoJwt,
  ssoLogout,
  ssoRefreshes as refreshes,
  ssoRoleRequested,
  ssoRoleSwitches,
  ssoUser,
  stubSso,
} from './testing/sso.ts';

const SSO = 'https://sso.example.test';
const CHANNEL = 'common-ui-test-session';

let store: Store;
let session: Session;

const startSession = (timings?: SessionTimings): (() => void) => session.start({ timings });
const pendingRefresh = (): Promise<void> => session.pendingRefresh();
const signOut = (): Promise<{ reachedSso: boolean }> => session.signOut();

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

/** Resolves once every channel open before the call has received `data`. */
async function announceFromOtherTab(data: unknown): Promise<void> {
  const witness = new BroadcastChannel(CHANNEL);
  const delivered = new Promise<void>((resolve) => {
    witness.addEventListener('message', () => resolve(), { once: true });
  });
  otherTab.postMessage(data);
  await delivered;
  witness.close();
}

beforeEach(() => {
  stubSso();
  sessionStorage.clear();
  store = createStore();
  store.set(odbTokenAtom, null);
  session = createSession({ store, ssoUri: SSO, channelName: CHANNEL });
  otherTab = new BroadcastChannel(CHANNEL);
});

afterEach(() => {
  stop?.();
  stop = undefined;
  otherTab.close();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe(createSession, () => {
  it('waits the shared refresh timeout by default', () => {
    expect(SESSION_TIMINGS.refreshTimeoutMs).toBe(REFRESH_TIMEOUT_MS);
  });

  it('asks the SSO the app names, read at the moment of each refresh', async () => {
    let ssoUri = 'https://first.example.test';
    session = createSession({ store, ssoUri: () => ssoUri, channelName: CHANNEL });
    stop = startSession();
    await answerRefresh(0, { status: 500 });
    ssoUri = 'https://second.example.test';

    stop();
    stop = startSession();

    expect(refreshes().map((made) => new URL(made.url).origin)).toEqual([
      'https://first.example.test',
      'https://second.example.test',
    ]);
  });

  it('keeps its own channel, so a sign-out in another app leaves this one alone', async () => {
    const token = ssoJwt(ssoUser('staff'));
    store.set(odbTokenAtom, token);
    stop = startSession();
    const otherApp = new BroadcastChannel('another-app-session');
    const delivered = new Promise<void>((resolve) => {
      const witness = new BroadcastChannel('another-app-session');
      witness.addEventListener('message', () => {
        witness.close();
        resolve();
      });
    });

    otherApp.postMessage(SIGNED_OUT_MESSAGE);
    await delivered;
    otherApp.close();

    expect(store.get(odbTokenAtom)).toBe(token);
  });
});

describe('start', () => {
  it('signs a returning reader in from the SSO session cookie', async () => {
    stop = startSession();
    expect(refreshes()).toHaveLength(1);

    const token = ssoJwt(ssoUser('staff'));
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
    const token = ssoJwt(ssoUser('staff'));
    store.set(odbTokenAtom, token);

    stop = startSession();

    expect(ssoCalls()).toHaveLength(0);
    expect(store.get(sessionCheckedAtom)).toBe(true);
    expect(store.get(odbTokenAtom)).toBe(token);
  });

  it('refreshes once the token reaches its own refresh deadline', async () => {
    store.set(odbTokenAtom, ssoJwt(ssoUser('staff'), 0.1));

    stop = startSession({ ...FAST, refreshAheadMs: 60 });
    expect(refreshes()).toHaveLength(0);

    await expectRefreshes(1);
  });

  it('asks nothing before the token own refresh deadline', () => {
    fakeTimeouts();
    store.set(odbTokenAtom, ssoJwt(ssoUser('staff'), 120));

    stop = startSession();

    vi.advanceTimersByTime(89_000);
    expect(refreshes()).toHaveLength(0);
  });

  it('asks nothing inside the minimum interval after an answer, from a refocus or its own timer', async () => {
    fakeTimeouts();
    store.set(odbTokenAtom, ssoJwt(ssoUser('staff'), 20));

    stop = startSession();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(refreshes()).toHaveLength(1);

    await answerRefresh(0, { body: ssoJwt(ssoUser('staff'), 20) });

    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(29_000);
    expect(refreshes()).toHaveLength(1);
  });

  it('asks again once the minimum interval passes when the fresh token expires when the old one did', async () => {
    const token = ssoJwt(ssoUser('staff'), 20);
    store.set(odbTokenAtom, token);

    stop = startSession(FAST);
    await expectRefreshes(1);

    await answerRefresh(0, { body: token });

    await expectRefreshes(2);
  });

  it('keeps one in-flight refresh when a second trigger crosses the retry floor before it lands', async () => {
    store.set(odbTokenAtom, ssoJwt(ssoUser('staff'), 20));

    stop = startSession({ ...SESSION_TIMINGS, minIntervalMs: 0 });
    document.dispatchEvent(new Event('visibilitychange'));
    const settled = pendingRefresh();

    document.dispatchEvent(new Event('visibilitychange'));

    expect(refreshes()).toHaveLength(1);
    expect(pendingRefresh()).toBe(settled);

    const token = ssoJwt(ssoUser('staff'));
    call(0).answer({ body: token });
    await settled;

    expect(store.get(odbTokenAtom)).toBe(token);
  });

  it.each(['a still-valid token', 'no token'] as const)(
    'asks again after the backoff when SSO cannot be reached, holding %s',
    async (holding) => {
      const token = holding === 'no token' ? null : ssoJwt(ssoUser('staff'), 20);
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

    // Without the cap, the last three rounds would wait 80, 160 and 320 ms.
    const cappedMs = waitedMs.slice(3).reduce((sum, ms) => sum + ms, 0);
    expect(cappedMs).toBeLessThan(80 + 160 + 320);
  });

  it('resets the backoff once a refresh finally succeeds, rather than keeping the wait it grew to', async () => {
    stop = startSession({ ...FAST, backoffCapMs: 1_000 });
    for (const round of [0, 1, 2, 3, 4, 5]) {
      await answerRefresh(round, { status: 500 });
      await expectRefreshes(round + 2);
    }

    await answerRefresh(6, { body: ssoJwt(ssoUser('staff'), 20) });
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
        store.set(odbTokenAtom, ssoJwt(ssoUser('staff'), 20));
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
        await answerRefresh(0, { body: ssoJwt(ssoUser('staff'), -60) });
      },
    ],
    [
      'SSO will not renew a stored token that has already expired',
      async () => {
        store.set(odbTokenAtom, ssoJwt(ssoUser('staff'), -60));
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

    await answerRefresh(0, { body: ssoJwt(ssoUser('staff'), -60) });

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
    store.set(odbTokenAtom, ssoJwt(ssoUser('staff'), 20));

    stop = startSession(FAST);
    await expectRefreshes(1);

    await answerRefresh(0, { status: 401 });

    expect(store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionCheckedAtom)).toBe(true);
  });

  it('refreshes a token past its deadline as soon as the tab is looked at again', async () => {
    store.set(odbTokenAtom, ssoJwt(ssoUser('staff'), 20));

    stop = startSession();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(refreshes()).toHaveLength(1);

    await answerRefresh(0, { status: 500 });

    document.dispatchEvent(new Event('visibilitychange'));

    expect(refreshes()).toHaveLength(1);
  });

  it('arms nothing early for a token that expires past the longest timer', () => {
    fakeTimeouts();
    const token = ssoJwt(ssoUser('staff'), 30 * 24 * 60 * 60);
    store.set(odbTokenAtom, token);

    stop = startSession();

    vi.advanceTimersByTime(SESSION_TIMINGS.maxTimerMs - 1);
    expect(refreshes()).toHaveLength(0);
    expect(store.get(odbTokenAtom)).toBe(token);
  });

  it('refreshes at the longest timer and holds the token until its own expiry', async () => {
    const token = ssoJwt(ssoUser('staff'), 2);
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

    call(0).answer({ body: ssoJwt(ssoUser('staff')) });
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
      const token = ssoJwt(ssoUser('staff'), 20);

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

    const survivor = ssoJwt(ssoUser('staff'));
    call(0).answer({ body: ssoJwt(ssoUser('pi')) });
    call(1).answer({ body: survivor });
    await Promise.all([first, second]);

    expect(store.get(odbTokenAtom)).toBe(survivor);
    expect(refreshes()).toHaveLength(2);
  });

  it('drops a stored token that has already expired at once, and signs out when SSO will not renew it', async () => {
    store.set(odbTokenAtom, ssoJwt(ssoUser('staff'), -60));

    stop = startSession();
    expect(refreshes()).toHaveLength(1);

    await expect.poll(() => store.get(odbTokenAtom)).toBeNull();

    await answerRefresh(0, { status: 403 });

    expect(store.get(sessionStatusAtom)).toBe('signed-out');
    expect(store.get(odbTokenAtom)).toBeNull();
  });

  it('drops a token once it expires while SSO is unreachable, and keeps asking on the backoff', async () => {
    store.set(odbTokenAtom, ssoJwt(ssoUser('staff'), 0.02));

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
    // Moving the clock lets a focus land past the minimum interval but inside the backoff.
    vi.useFakeTimers({ toFake: ['Date'] });
    store.set(odbTokenAtom, ssoJwt(ssoUser('staff'), 20));

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
    store.set(odbTokenAtom, ssoJwt(ssoUser('staff'), 0.03));

    stop = startSession(FAST);
    expect(store.get(sessionStatusAtom)).toBe('signed-in');
    await expectRefreshes(1);

    await expect.poll(() => store.get(sessionStatusAtom)).toBe('signed-out');
    expect(store.get(odbTokenAtom)).toBeNull();
    expect(refreshes()).toHaveLength(1);

    await answerRefresh(0, { body: ssoJwt(ssoUser('staff')) });

    expect(store.get(sessionStatusAtom)).toBe('signed-in');
  });

  it('leaves the token alone once stopped before it expires', () => {
    // Fake Date too. Otherwise the expiry timer finds the token live and re-arms.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const token = ssoJwt(ssoUser('staff'), 20);
    store.set(odbTokenAtom, token);

    const stopNow = startSession();

    stopNow();
    vi.advanceTimersByTime(25_000);

    expect(store.get(odbTokenAtom)).toBe(token);
  });
});

describe('signOut', () => {
  it('discards a refresh already in flight when signOut runs, and arms no new timer once it lands', async () => {
    fakeTimeouts();
    store.set(odbTokenAtom, ssoJwt(ssoUser('staff'), 20));

    stop = startSession();
    document.dispatchEvent(new Event('visibilitychange'));
    const late = pendingRefresh();
    expect(refreshes()).toHaveLength(1);

    const signedOut = signOut();
    expect(store.get(odbTokenAtom)).toBeNull();

    call(0).answer({ body: ssoJwt(ssoUser('pi')) });
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

    call(0).answer({ body: ssoJwt(ssoUser('staff')) });
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
    store.set(odbTokenAtom, ssoJwt(ssoUser('staff')));
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
    store.set(odbTokenAtom, ssoJwt(ssoUser('staff'), 20));

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
    store.set(odbTokenAtom, ssoJwt(ssoUser('staff')));
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
    store.set(odbTokenAtom, ssoJwt(ssoUser('staff')));
    stop = startSession();
    const signedOut = signOut();

    stop = startSession();
    const bootstrap = pendingRefresh();
    const witness = new BroadcastChannel(CHANNEL);
    const lateAnnouncement = new Promise<void>((resolve) => {
      witness.addEventListener('message', () => resolve(), { once: true });
    });
    ssoLogout().answer({ status: 500 });
    await signedOut;
    await lateAnnouncement;
    witness.close();

    expect(refreshes()[0]?.signal?.aborted).toBe(true);
    refreshes()[0]?.answer({ body: ssoJwt(ssoUser('staff')) });
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
    const token = ssoJwt(ssoUser('staff'));
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
    const token = ssoJwt(ssoUser('staff'));
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

describe('signIn', () => {
  it('keeps a token handed in after a sign-out alive, renewing it before it expires', async () => {
    store.set(odbTokenAtom, ssoJwt(ssoUser('staff')));
    stop = startSession({ ...FAST, refreshAheadMs: 60 });
    const signedOut = signOut();
    ssoLogout().answer({ status: 200 });
    await signedOut;

    const guest = ssoJwt({ type: 'guest', id: 'g-1' }, 0.1);
    session.signIn(guest);

    expect(store.get(odbTokenAtom)).toBe(guest);
    await expectRefreshes(1);
  });

  it('listens for a sign-out in another tab again once a token is handed in', async () => {
    store.set(odbTokenAtom, ssoJwt(ssoUser('staff')));
    stop = startSession();
    await announceFromOtherTab(SIGNED_OUT_MESSAGE);
    expect(store.get(signedOutElsewhereAtom)).toBe(true);

    session.signIn(ssoJwt(ssoUser('staff')));
    expect(store.get(signedOutElsewhereAtom)).toBe(false);

    await announceFromOtherTab(SIGNED_OUT_MESSAGE);
    expect(store.get(odbTokenAtom)).toBeNull();
  });

  it('starts nothing for a keeper that is not running', () => {
    fakeTimeouts();
    const stopNow = startSession();
    stopNow();
    const token = ssoJwt(ssoUser('staff'), 20);

    session.signIn(token);
    vi.advanceTimersByTime(10_000_000);

    expect(store.get(odbTokenAtom)).toBe(token);
    expect(refreshes()).toHaveLength(1);
  });

  it('leaves the keeper it restarted to the stop of the mount that started it', async () => {
    fakeTimeouts();
    store.set(odbTokenAtom, ssoJwt(ssoUser('staff')));
    const stopNow = startSession();
    const signedOut = signOut();
    ssoLogout().answer({ status: 200 });
    await signedOut;
    session.signIn(ssoJwt(ssoUser('staff'), 20));

    stopNow();
    vi.advanceTimersByTime(10_000_000);

    expect(refreshes()).toHaveLength(0);
  });
});

describe('role policy', () => {
  const staff: StandardRole = { type: 'staff', id: 'r-staff' };
  const admin: StandardRole = { type: 'admin', id: 'r-admin' };
  const ngo: StandardRole = { type: 'ngo', id: 'r-ngo', partner: 'us' };

  let outcomes: RoleSwitchOutcome[];

  const startWithPolicy = (preferRoles: readonly StandardRole['type'][], timings?: SessionTimings): void => {
    session = createSession({ store, ssoUri: SSO, channelName: CHANNEL, preferRoles });
    stop = session.start({ timings, onRoleSwitch: (outcome) => outcomes.push(outcome) });
  };

  async function answerRoleSwitch(index: number, response: Parameters<PendingSsoCall['answer']>[0]): Promise<void> {
    ssoRoleSwitches()[index]?.answer(response);
    await expect.poll(() => refreshes().length + outcomes.length, { interval: 1 }).toBeGreaterThan(0);
  }

  async function answerLatestRefresh(response: Parameters<PendingSsoCall['answer']>[0]): Promise<void> {
    await expectRefreshes(1);
    const settled = pendingRefresh();
    refreshes().at(-1)?.answer(response);
    await settled;
  }

  beforeEach(() => {
    outcomes = [];
  });

  it('switches a signed-in user to the first listed role they hold, and holds the token for it', async () => {
    store.set(odbTokenAtom, ssoJwt(ssoUser('pi', [ngo, admin, staff])));

    startWithPolicy(['staff', 'admin']);

    expect(ssoRoleSwitches()).toHaveLength(1);
    expect(ssoRoleRequested(0)).toBe(admin.id);

    await answerRoleSwitch(0, { status: 200 });
    const switched = ssoJwt(ssoUser('admin', [staff]));
    await answerLatestRefresh({ body: switched });

    await expect.poll(() => outcomes).toEqual([{ kind: 'switched', role: admin }]);
    expect(store.get(odbTokenAtom)).toBe(switched);
    expect(ssoRoleSwitches()).toHaveLength(1);
  });

  it('switches the user a bootstrap signs in', async () => {
    startWithPolicy(['staff']);

    await answerRefresh(0, { body: ssoJwt(ssoUser('pi', [staff])) });

    expect(ssoRoleSwitches()).toHaveLength(1);
    expect(ssoRoleRequested(0)).toBe(staff.id);
  });

  it.each([
    ['already holds a listed role', ssoUser('staff', [admin])],
    ['holds none of the listed roles', ssoUser('pi', [ngo])],
    ['is a guest', { type: 'guest', id: 'g-1' } as const],
    ['is a service', { type: 'service', id: 's-1', name: 'scheduler' } as const],
  ])('asks SSO nothing when the user %s', (_, user) => {
    store.set(odbTokenAtom, ssoJwt(user));

    startWithPolicy(['staff', 'admin']);

    expect(ssoCalls()).toHaveLength(0);
    expect(outcomes).toEqual([]);
  });

  it('asks SSO nothing without a role policy', () => {
    store.set(odbTokenAtom, ssoJwt(ssoUser('pi', [staff])));

    stop = startSession();

    expect(ssoCalls()).toHaveLength(0);
  });

  it('reports the failure when SSO refuses the switch, and asks no more for that token', async () => {
    store.set(odbTokenAtom, ssoJwt(ssoUser('pi', [staff])));
    startWithPolicy(['staff']);

    await answerRoleSwitch(0, { status: 403, body: 'User does not own role.' });

    expect(outcomes).toMatchObject([{ kind: 'failed', role: staff }]);
    const [outcome] = outcomes;
    expect(outcome?.kind === 'failed' ? String(outcome.error) : '').toMatch(/User does not own role/);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(ssoRoleSwitches()).toHaveLength(1);
    expect(refreshes()).toHaveLength(0);
  });

  it('reports the failure when SSO accepts the switch but the refresh brings back no token', async () => {
    store.set(odbTokenAtom, ssoJwt(ssoUser('pi', [staff])));
    startWithPolicy(['staff']);

    await answerRoleSwitch(0, { status: 200 });
    await answerLatestRefresh({ status: 500 });

    await expect.poll(() => outcomes.map((outcome) => outcome.kind)).toEqual(['failed']);
  });

  it('tries again for the next token after a failed switch', async () => {
    store.set(odbTokenAtom, ssoJwt(ssoUser('pi', [staff])));
    startWithPolicy(['staff']);
    await answerRoleSwitch(0, { status: 403 });

    store.set(odbTokenAtom, ssoJwt(ssoUser('pi', [staff]), 7200));

    expect(ssoRoleSwitches()).toHaveLength(2);
  });

  it('reports nothing and refreshes nothing once stopped mid-switch', async () => {
    store.set(odbTokenAtom, ssoJwt(ssoUser('pi', [staff])));
    startWithPolicy(['staff']);

    stop?.();
    stop = undefined;
    expect(ssoRoleSwitches()[0]?.signal?.aborted).toBe(true);
    ssoRoleSwitches()[0]?.answer({ status: 200 });
    await announceFromOtherTab('flush');

    expect(outcomes).toEqual([]);
    expect(refreshes()).toHaveLength(0);
  });

  it('gives up on a switch SSO does not answer in time, and reports it', async () => {
    fakeTimeouts();
    store.set(odbTokenAtom, ssoJwt(ssoUser('pi', [staff])));
    startWithPolicy(['staff']);

    vi.advanceTimersByTime(REFRESH_TIMEOUT_MS);
    expect(ssoRoleSwitches()[0]?.signal?.reason).toMatchObject({ name: 'TimeoutError' });
    vi.useRealTimers();
    ssoRoleSwitches()[0]?.fail();

    await expect.poll(() => outcomes.map((outcome) => outcome.kind)).toEqual(['failed']);
  });

  it("switches at the reader's request after the refresh in flight, so the older token cannot land over it", async () => {
    const renewed = ssoJwt(ssoUser('staff', [admin]));
    store.set(odbTokenAtom, ssoJwt(ssoUser('staff', [admin]), 20));
    startWithPolicy(['staff', 'admin']);
    await expectRefreshes(1);

    const outcome = session.switchRole(admin);
    await expect.poll(() => ssoRoleSwitches()).toHaveLength(1);
    expect(ssoRoleRequested(0)).toBe(admin.id);
    ssoRoleSwitches()[0]?.answer({ status: 200 });
    await answerRefresh(0, { body: renewed });
    expect(store.get(odbTokenAtom)).toBe(renewed);

    const switched = ssoJwt(ssoUser('admin', [staff]));
    await expectRefreshes(2);
    const settled = session.pendingRefresh();
    refreshes()[1]?.answer({ body: switched });
    await settled;

    expect(await outcome).toEqual({ kind: 'switched', role: admin });
    expect(store.get(odbTokenAtom)).toBe(switched);
    expect(outcomes).toEqual([]);
  });

  it('fails a requested switch without asking SSO when the keeper is not running', async () => {
    store.set(odbTokenAtom, ssoJwt(ssoUser('staff', [admin])));

    const outcome = await session.switchRole(admin);

    expect(outcome).toMatchObject({ kind: 'failed', role: admin, error: { message: 'The session is not running.' } });
    expect(ssoCalls()).toHaveLength(0);
  });
});

describe(planRoleSwitch, () => {
  const staff: StandardRole = { type: 'staff', id: 'r-staff' };
  const admin: StandardRole = { type: 'admin', id: 'r-admin' };

  it('keeps a user whose active role is listed', () => {
    expect(planRoleSwitch(ssoUser('staff', [admin]), ['admin', 'staff'])).toEqual({ kind: 'keep' });
  });

  it('switches to the first of the other roles that is listed', () => {
    expect(planRoleSwitch(ssoUser('pi', [staff, admin]), ['admin', 'staff'])).toEqual({ kind: 'switch', role: staff });
  });

  it('names the active role when no listed role is held', () => {
    const user = ssoUser('ngo');

    expect(planRoleSwitch(user, ['staff'])).toEqual({ kind: 'unavailable', active: user.role });
  });

  it.each([
    ['nobody', null],
    ['a guest', { type: 'guest', id: 'g-1' } as const],
    ['a service user', { type: 'service', id: 's-1', name: 'scheduler' } as const],
  ])('keeps %s', (_, user) => {
    expect(planRoleSwitch(user, ['staff'])).toEqual({ kind: 'keep' });
  });

  it('keeps everyone under an empty policy', () => {
    expect(planRoleSwitch(ssoUser('pi', [staff]), [])).toEqual({ kind: 'keep' });
  });
});

describe(sessionPerStore, () => {
  it('builds one keeper per store, reading the options only the first time', () => {
    const options = vi.fn((channelName: string) => ({ ssoUri: SSO, channelName }));
    const sessionFor = sessionPerStore(options);
    const other = createStore();

    const first = sessionFor(store, CHANNEL);
    expect(sessionFor(store, 'ignored')).toBe(first);
    expect(first.store).toBe(store);
    const second = sessionFor(other, CHANNEL);

    expect(second).not.toBe(first);
    expect(second.store).toBe(other);
    expect(options.mock.calls).toEqual([[CHANNEL], [CHANNEL]]);
  });
});

describe(useSessionStatus, () => {
  it('reads checking before the session has been asked', () => {
    expect(store.get(sessionStatusAtom)).toBe('checking');
  });

  it('reads signed-out once checked with no token', () => {
    store.set(sessionCheckedAtom, true);

    expect(store.get(sessionStatusAtom)).toBe('signed-out');
  });

  it('reads signed-in for a valid token, checked or not', () => {
    store.set(odbTokenAtom, ssoJwt(ssoUser('staff')));

    expect(store.get(sessionStatusAtom)).toBe('signed-in');

    store.set(sessionCheckedAtom, true);
    expect(store.get(sessionStatusAtom)).toBe('signed-in');
  });

  it('reads signed-out for an expired token once the session has been checked', () => {
    store.set(odbTokenAtom, ssoJwt(ssoUser('staff'), -10));
    store.set(sessionCheckedAtom, true);

    expect(store.get(sessionStatusAtom)).toBe('signed-out');
  });

  it('reads checking, not signed-out, for an expired token before the session has been checked', () => {
    store.set(odbTokenAtom, ssoJwt(ssoUser('staff'), -10));

    expect(store.get(sessionStatusAtom)).toBe('checking');
  });
});

describe(setToken, () => {
  it('holds the session for the tab when storage refuses to persist it', () => {
    const jwt = ssoJwt(ssoUser('staff'));
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
        setToken(store, ssoJwt(ssoUser('staff')));
      }).toThrow(AggregateError);
    } finally {
      unsubscribe();
    }
  });

  it('clears the signed-out-elsewhere notice when a token arrives', () => {
    store.set(signedOutElsewhereAtom, true);

    setToken(store, ssoJwt(ssoUser('staff')));

    expect(store.get(signedOutElsewhereAtom)).toBe(false);
  });
});
