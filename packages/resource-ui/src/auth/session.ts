import {
  isLoggedInAtom,
  odbTokenAtom,
  sessionCheckedAtom,
  setToken,
  signedOutElsewhereAtom,
  tokenExpAtom,
} from '@/components/atoms/auth';
import { store } from '@/components/atoms/store';

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

let timings = SESSION_TIMINGS;
let sessionId = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
let abortController: AbortController | undefined;
let inFlight: Promise<void> | undefined;
let unsubscribe: (() => void) | undefined;
let channel: BroadcastChannel | undefined;
let backoffMs = 0;
let retryNotBefore = 0;
let refreshDueAt: number | null = null;
let lastAttemptAt = 0;

export const pendingRefresh = (): Promise<void> => inFlight ?? Promise.resolve();

function clearTimers(): void {
  if (timer !== undefined) clearTimeout(timer);
  if (expiryTimer !== undefined) clearTimeout(expiryTimer);
  timer = undefined;
  expiryTimer = undefined;
}

function armExpiry(): void {
  if (expiryTimer !== undefined) clearTimeout(expiryTimer);
  expiryTimer = undefined;
  if (store.get(odbTokenAtom) === null) return;

  const exp = store.get(tokenExpAtom);
  expiryTimer = setTimeout(expireToken, Math.min(timings.maxTimerMs, Math.max(0, (exp?.getTime() ?? 0) - Date.now())));
}

function expireToken(): void {
  const exp = store.get(tokenExpAtom);
  if (exp !== null && exp.getTime() > Date.now()) {
    armExpiry();
    return;
  }
  try {
    setToken(store, null);
  } catch (error: unknown) {
    console.error('Session expiry: a subscriber of the token atom failed.', error);
  }
}

function arm(): void {
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
}

function apply(result: RefreshResult): void {
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
}

function refresh(): Promise<void> {
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
}

function cancel(): void {
  clearTimers();
  abortController?.abort();
  abortController = undefined;
  inFlight = undefined;
  backoffMs = 0;
  retryNotBefore = 0;
  refreshDueAt = null;
  lastAttemptAt = 0;
}

function teardown(): void {
  cancel();
  unsubscribe?.();
  unsubscribe = undefined;
  document.removeEventListener('visibilitychange', onVisibilityChange);
  channel?.close();
  channel = undefined;
}

function endSession(reason: string): void {
  teardown();
  try {
    setToken(store, null);
  } catch (error: unknown) {
    console.error(`${reason}: a subscriber of the token atom failed.`, error);
  }
  store.set(sessionCheckedAtom, true);
}

function onSignedOutElsewhere(event: MessageEvent<unknown>): void {
  if (event.data !== SIGNED_OUT_MESSAGE) return;
  store.set(signedOutElsewhereAtom, true);
  endSession('Sign out in another tab');
}

function onVisibilityChange(): void {
  if (document.visibilityState !== 'visible') return;
  if (Date.now() - lastAttemptAt < timings.minIntervalMs) return;
  if (Date.now() < retryNotBefore) return;
  const exp = store.get(tokenExpAtom);
  if (exp !== null && Date.now() < exp.getTime() - timings.refreshAheadMs) return;
  void refresh();
}

export function startSession(sessionTimings: SessionTimings = SESSION_TIMINGS): () => void {
  if (unsubscribe !== undefined) teardown();
  timings = sessionTimings;
  sessionId += 1;
  const mySession = sessionId;

  unsubscribe = store.sub(odbTokenAtom, arm);
  document.addEventListener('visibilitychange', onVisibilityChange);
  channel = new BroadcastChannel(SESSION_CHANNEL);
  channel.addEventListener('message', onSignedOutElsewhere);

  if (store.get(isLoggedInAtom)) {
    store.set(sessionCheckedAtom, true);
  } else {
    void refresh();
  }
  arm();

  return () => {
    if (sessionId === mySession) teardown();
  };
}

export async function signOut(): Promise<{ reachedSso: boolean }> {
  const announced = channel !== undefined;
  channel?.postMessage(SIGNED_OUT_MESSAGE);
  endSession('Sign out');
  try {
    await logout();
    return { reachedSso: true };
  } catch {
    return { reachedSso: false };
  } finally {
    // A tab that loaded during the logout missed the first post and may have renewed from the cookie.
    if (announced) {
      const late = new BroadcastChannel(SESSION_CHANNEL);
      late.postMessage(SIGNED_OUT_MESSAGE);
      late.close();
    }
  }
}
