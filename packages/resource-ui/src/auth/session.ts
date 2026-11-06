import type { Store } from 'jotai';

import {
  isLoggedInAtom,
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

export const SESSION_TIMINGS: SessionTimings = {
  refreshAheadMs: 30_000,
  minIntervalMs: 30_000,
  backoffCapMs: 16 * 60_000,
  maxTimerMs: 2_147_483_647,
  refreshTimeoutMs: REFRESH_TIMEOUT_MS,
};

export const SESSION_CHANNEL = 'resource-session';
export const SIGNED_OUT_MESSAGE = 'signed-out';

interface Keeper {
  readonly channel: BroadcastChannel;
  readonly pendingRefresh: () => Promise<void> | undefined;
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
  stopCurrent();
  dropToken(store, reason);
  store.set(sessionCheckedAtom, true);
}

function createKeeper(store: Store, timings: SessionTimings): Keeper {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let expiryTimer: ReturnType<typeof setTimeout> | undefined;
  let abortController: AbortController | undefined;
  let inFlight: Promise<void> | undefined;
  let backoffMs = 0;
  let retryNotBefore = 0;
  let refreshDueAt: number | null = null;
  let lastAttemptAt = 0;

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
      refreshDueAt = exp !== null && exp.getTime() > now ? exp.getTime() - timings.refreshAheadMs : null;
    }
    const backoffDue = retryNotBefore === 0 ? null : retryNotBefore;
    if (refreshDueAt === null && backoffDue === null) return;

    const delay = Math.min(
      timings.maxTimerMs,
      Math.max(0, (refreshDueAt ?? 0) - now, (backoffDue ?? 0) - now, lastAttemptAt + timings.minIntervalMs - now),
    );
    timer = setTimeout(() => {
      void refresh();
    }, delay);
  };

  const apply = (result: RefreshResult): void => {
    try {
      switch (result.kind) {
        case 'token': {
          backoffMs = 0;
          retryNotBefore = 0;
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
          backoffMs = 0;
          retryNotBefore = 0;
          refreshDueAt = null;
          setToken(store, null);
          break;
        case 'unreachable': {
          backoffMs = backoffMs === 0 ? timings.minIntervalMs : Math.min(backoffMs * 2, timings.backoffCapMs);
          retryNotBefore = Date.now() + backoffMs;
          break;
        }
      }
    } finally {
      store.set(sessionCheckedAtom, true);
      arm();
    }
  };

  const refresh = (): Promise<void> => {
    if (inFlight !== undefined) return inFlight;

    const controller = new AbortController();
    abortController = controller;
    lastAttemptAt = Date.now();

    const run = refreshSession(controller.signal, timings.refreshTimeoutMs)
      .then((result) => {
        if (!controller.signal.aborted) apply(result);
      })
      .catch((error: unknown) => {
        console.error('Session refresh: a subscriber of the token atom failed.', error);
      })
      .finally(() => {
        if (abortController === controller) {
          inFlight = undefined;
          abortController = undefined;
        }
      });
    inFlight = run;
    return run;
  };

  const handleSignedOutElsewhere = (event: MessageEvent<unknown>): void => {
    if (event.data !== SIGNED_OUT_MESSAGE) return;
    if (store.get(sessionStatusAtom) === 'signed-in') store.set(sessionEndingAtom, 'logged-out-elsewhere');
    endSession(store, 'Sign out in another tab');
  };

  const handleVisibilityChange = (): void => {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - lastAttemptAt < timings.minIntervalMs) return;
    if (Date.now() < retryNotBefore) return;
    const exp = store.get(tokenExpAtom);
    if (exp !== null && Date.now() < exp.getTime() - timings.refreshAheadMs) return;
    void refresh();
  };

  // Only a session that was signed in earns a notice.
  let lastStatus = store.get(sessionStatusAtom);
  const handleStatusChange = (): void => {
    const status = store.get(sessionStatusAtom);
    if (lastStatus === 'signed-in' && status !== 'signed-in' && store.get(sessionEndingAtom) === 'none') {
      store.set(sessionEndingAtom, 'lapsed');
    }
    lastStatus = status;
  };

  const unsubscribe = store.sub(odbTokenAtom, arm);
  const unsubscribeStatus = store.sub(sessionStatusAtom, handleStatusChange);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  const channel = new BroadcastChannel(SESSION_CHANNEL);
  channel.addEventListener('message', handleSignedOutElsewhere);

  const stop = (): void => {
    clearTimers();
    abortController?.abort();
    abortController = undefined;
    inFlight = undefined;
    unsubscribe();
    unsubscribeStatus();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    channel.close();
  };

  if (store.get(isLoggedInAtom)) {
    store.set(sessionCheckedAtom, true);
  } else {
    void refresh();
  }
  arm();

  return { channel, pendingRefresh: () => inFlight, stop };
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
  if (announced) {
    const late = new BroadcastChannel(SESSION_CHANNEL);
    late.postMessage(SIGNED_OUT_MESSAGE);
    late.close();
  }
  return { reachedSso };
}
