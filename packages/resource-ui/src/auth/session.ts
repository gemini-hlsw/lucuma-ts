import type { Store } from 'jotai';

import {
  odbTokenAtom,
  sessionCheckedAtom,
  sessionEndingAtom,
  sessionStatusAtom,
  setToken,
  tokenExpAtom,
} from '@/components/atoms/auth';

import { logout, REFRESH_TIMEOUT_MS, type RefreshResult, refreshSession } from './ssoClient';

export interface SessionTimings {
  readonly refreshAheadMs: number;
  readonly minIntervalMs: number;
  readonly backoffCapMs: number;
  /** A longer `setTimeout` delay overflows and fires at once. */
  readonly maxTimerMs: number;
  readonly refreshTimeoutMs: number;
}

export const SESSION_TIMINGS = {
  refreshAheadMs: 30_000,
  minIntervalMs: 30_000,
  backoffCapMs: 16 * 60_000,
  maxTimerMs: 2_147_483_647,
  refreshTimeoutMs: REFRESH_TIMEOUT_MS,
} as const satisfies SessionTimings;

export const SESSION_CHANNEL = 'resource-session';
export const SIGNED_OUT_MESSAGE = 'signed-out';

interface Keeper {
  readonly channel: BroadcastChannel;
  readonly pendingRefresh: () => Promise<void> | undefined;
  readonly reset: () => void;
  readonly stop: () => void;
}

let current: Keeper | undefined;

export const pendingRefresh = (): Promise<void> => current?.pendingRefresh() ?? Promise.resolve();

function stopCurrent(): void {
  current?.stop();
  current = undefined;
}

function dropToken(store: Store, reason: string): void {
  try {
    setToken(store, null);
  } catch (error: unknown) {
    console.error(`${reason}: a subscriber of the token atom failed.`, error);
  }
}

function endSession(store: Store, reason: string): void {
  current?.reset();
  dropToken(store, reason);
  store.set(sessionCheckedAtom, true);
}

interface Backoff {
  readonly ms: number;
  readonly notBefore: number;
}

interface Waiting {
  readonly kind: 'waiting';
  readonly refreshDueAt: number | null;
  readonly backoff: Backoff | null;
}

interface Refreshing {
  readonly kind: 'refreshing';
  readonly refreshDueAt: number | null;
  readonly backoff: Backoff | null;
  readonly controller: AbortController;
  readonly run: Promise<void>;
}

// The SSO cookie may outlive a failed logout, so until a new token arrives nothing asks to renew.
interface Ended {
  readonly kind: 'ended';
}

type KeeperState = Waiting | Refreshing | Ended;

const IDLE = { kind: 'waiting', refreshDueAt: null, backoff: null } as const satisfies Waiting;

function nextBackoffMs(backoff: Backoff | null, timings: SessionTimings): number {
  return backoff === null ? timings.minIntervalMs : Math.min(backoff.ms * 2, timings.backoffCapMs);
}

interface Answer {
  readonly from: Refreshing;
  readonly result: RefreshResult;
  readonly now: number;
  readonly timings: SessionTimings;
}

function afterAnswer({ from, result, now, timings }: Answer): Waiting {
  switch (result.kind) {
    case 'token':
      return { kind: 'waiting', refreshDueAt: from.refreshDueAt, backoff: null };
    case 'rejected':
      return IDLE;
    case 'unreachable': {
      const ms = nextBackoffMs(from.backoff, timings);
      return { kind: 'waiting', refreshDueAt: from.refreshDueAt, backoff: { ms, notBefore: now + ms } };
    }
  }
}

function abandon({ refreshDueAt, backoff }: Refreshing): Waiting {
  return { kind: 'waiting', refreshDueAt, backoff };
}

function withRefreshDueAt(state: KeeperState, refreshDueAt: number | null): Waiting | Refreshing {
  switch (state.kind) {
    case 'waiting':
    case 'refreshing':
      return { ...state, refreshDueAt };
    case 'ended':
      return { ...IDLE, refreshDueAt };
  }
}

interface Schedule {
  readonly state: Waiting | Refreshing;
  readonly lastAttemptAt: number;
  readonly now: number;
  readonly timings: SessionTimings;
}

function refreshDelayMs({ state, lastAttemptAt, now, timings }: Schedule): number | null {
  const { refreshDueAt, backoff } = state;
  if (refreshDueAt === null && backoff === null) return null;
  return Math.min(
    timings.maxTimerMs,
    Math.max(
      0,
      (refreshDueAt ?? 0) - now,
      (backoff?.notBefore ?? 0) - now,
      lastAttemptAt + timings.minIntervalMs - now,
    ),
  );
}

interface FocusCheck extends Schedule {
  readonly exp: Date | null;
}

function isFocusRefreshDue({ state, lastAttemptAt, now, timings, exp }: FocusCheck): boolean {
  if (now - lastAttemptAt < timings.minIntervalMs) return false;
  if (state.backoff !== null && now < state.backoff.notBefore) return false;
  return exp === null || now >= exp.getTime() - timings.refreshAheadMs;
}

function createKeeper(store: Store, timings: SessionTimings): Keeper {
  let state: KeeperState = IDLE;
  let lastAttemptAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let expiryTimer: ReturnType<typeof setTimeout> | undefined;

  const clearTimers = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    if (expiryTimer !== undefined) clearTimeout(expiryTimer);
    timer = undefined;
    expiryTimer = undefined;
  };

  const expireToken = (): void => {
    const exp = store.get(tokenExpAtom);
    if (exp !== null && exp.getTime() > Date.now()) {
      armExpiry();
      return;
    }
    dropToken(store, 'Session expiry');
  };

  const armExpiry = (): void => {
    if (expiryTimer !== undefined) clearTimeout(expiryTimer);
    expiryTimer = undefined;
    if (store.get(odbTokenAtom) === null) return;

    const exp = store.get(tokenExpAtom);
    expiryTimer = setTimeout(
      expireToken,
      Math.min(timings.maxTimerMs, Math.max(0, (exp?.getTime() ?? 0) - Date.now())),
    );
  };

  const arm = (): void => {
    clearTimers();
    armExpiry();

    const now = Date.now();
    const exp = store.get(tokenExpAtom);
    // Dropping an expired token keeps its deadline, so the refresh it was waiting on still runs.
    if (store.get(odbTokenAtom) !== null) {
      state = withRefreshDueAt(
        state,
        exp !== null && exp.getTime() > now ? exp.getTime() - timings.refreshAheadMs : null,
      );
    }
    switch (state.kind) {
      case 'waiting': {
        const delay = refreshDelayMs({ state, lastAttemptAt, now, timings });
        if (delay === null) return;
        timer = setTimeout(() => {
          void refresh();
        }, delay);
        return;
      }
      // Every way out of a refresh arms again or ends the session.
      case 'refreshing':
      case 'ended':
        return;
    }
  };

  const apply = (result: RefreshResult): void => {
    try {
      switch (result.kind) {
        case 'token': {
          setToken(store, result.token);
          const exp = store.get(tokenExpAtom);
          if (exp !== null && exp.getTime() <= Date.now()) {
            console.warn(
              `Session refresh: SSO issued a token that expired ${Math.round((Date.now() - exp.getTime()) / 1000)} s ago; this browser's clock is probably ahead of the server's.`,
            );
          }
          break;
        }
        case 'rejected':
          setToken(store, null);
          break;
        case 'unreachable':
          break;
      }
    } finally {
      store.set(sessionCheckedAtom, true);
      arm();
    }
  };

  const refresh = (): Promise<void> => {
    switch (state.kind) {
      case 'refreshing':
        return state.run;
      case 'ended':
        return Promise.resolve();
      case 'waiting':
        break;
    }

    const controller = new AbortController();
    lastAttemptAt = Date.now();

    const run = refreshSession(controller.signal, timings.refreshTimeoutMs)
      .then((result) => {
        if (state.kind !== 'refreshing' || state.controller !== controller) return;
        // The token subscriber treats a token written mid-refresh as newer than the refresh, so the answer must not look in flight.
        state = afterAnswer({ from: state, result, now: Date.now(), timings });
        apply(result);
      })
      .catch((error: unknown) => {
        console.error('Session refresh: a subscriber of the token atom failed.', error);
        // A rejection that skipped the answer must not leave the keeper refreshing with no timer to retry.
        if (state.kind === 'refreshing' && state.controller === controller) {
          state = abandon(state);
          arm();
        }
      });
    state = { ...state, kind: 'refreshing', controller, run };
    return run;
  };

  const handleSignedOutElsewhere = (event: MessageEvent<unknown>): void => {
    if (event.data !== SIGNED_OUT_MESSAGE) return;
    if (store.get(sessionStatusAtom) === 'signed-in') store.set(sessionEndingAtom, 'logged-out-elsewhere');
    endSession(store, 'Sign out in another tab');
  };

  const handleVisibilityChange = (): void => {
    if (document.visibilityState !== 'visible') return;
    switch (state.kind) {
      case 'waiting':
      case 'refreshing':
        if (isFocusRefreshDue({ state, lastAttemptAt, now: Date.now(), timings, exp: store.get(tokenExpAtom) })) {
          void refresh();
        }
        return;
      case 'ended':
        return;
    }
  };

  // A token that arrived by another path, such as a guest sign-in, is newer than any answer still in flight.
  const handleTokenChange = (): void => {
    if (state.kind === 'refreshing' && store.get(odbTokenAtom) !== null) {
      state.controller.abort();
      state = abandon(state);
      store.set(sessionCheckedAtom, true);
    }
    arm();
  };

  // Only a session the gate opened earns a notice, so a stored token SSO refuses at load ends nothing.
  let lastStatus = store.get(sessionStatusAtom);
  const handleStatusChange = (): void => {
    const status = store.get(sessionStatusAtom);
    if (lastStatus === 'signed-in' && status !== 'signed-in' && store.get(sessionEndingAtom) === 'none') {
      store.set(sessionEndingAtom, 'lapsed');
    }
    lastStatus = status;
  };

  const unsubscribe = store.sub(odbTokenAtom, handleTokenChange);
  const unsubscribeStatus = store.sub(sessionStatusAtom, handleStatusChange);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  const channel = new BroadcastChannel(SESSION_CHANNEL);
  channel.addEventListener('message', handleSignedOutElsewhere);

  const reset = (): void => {
    clearTimers();
    if (state.kind === 'refreshing') state.controller.abort();
    state = { kind: 'ended' };
  };

  const stop = (): void => {
    reset();
    unsubscribe();
    unsubscribeStatus();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    channel.close();
  };

  if (!store.get(sessionCheckedAtom)) void refresh();
  arm();

  return { channel, pendingRefresh: () => (state.kind === 'refreshing' ? state.run : undefined), reset, stop };
}

export function startSession(store: Store, timings: SessionTimings = SESSION_TIMINGS): () => void {
  stopCurrent();
  const keeper = createKeeper(store, timings);
  current = keeper;

  return () => {
    if (current === keeper) stopCurrent();
  };
}

export async function signOut(store: Store): Promise<{ reachedSso: boolean }> {
  const announced = current !== undefined;
  current?.channel.postMessage(SIGNED_OUT_MESSAGE);
  store.set(sessionEndingAtom, 'logging-out');
  endSession(store, 'Sign out');
  const reachedSso = await logout().then(
    () => true,
    () => false,
  );
  if (store.get(sessionEndingAtom) === 'logging-out') {
    store.set(sessionEndingAtom, reachedSso ? 'logged-out' : 'logout-missed-sso');
  }
  // A tab that loaded during the logout missed the first post and may have renewed from the cookie.
  // The keeper's channel does not hear itself, so a guest who signed in here meanwhile stays.
  if (announced) {
    if (current === undefined) {
      const late = new BroadcastChannel(SESSION_CHANNEL);
      late.postMessage(SIGNED_OUT_MESSAGE);
      late.close();
    } else {
      current.channel.postMessage(SIGNED_OUT_MESSAGE);
    }
  }
  return { reachedSso };
}
