import {
  expiryTickAtom,
  isLoggedInAtom,
  odbTokenAtom,
  sessionCheckedAtom,
  setToken,
  tokenExpAtom,
} from '@/components/atoms/auth';
import { store } from '@/components/atoms/store';

import { logout, type RefreshResult, refreshSession } from './ssoClient';

const REFRESH_AHEAD_MS = 30_000;
const MIN_INTERVAL_MS = 30_000;
const BACKOFF_CAP_MS = 16 * 60_000;
const MAX_TIMEOUT_MS = 2_147_483_647;

let sessionId = 0;
let generation = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
let abortController: AbortController | undefined;
let inFlight: Promise<void> | undefined;
let unsubscribe: (() => void) | undefined;
let backoffMs = 0;
let retryNotBefore = 0;
let lastAttemptAt = 0;

export const pendingRefresh = (): Promise<void> => inFlight ?? Promise.resolve();

function clearTimers(): void {
  if (timer !== undefined) clearTimeout(timer);
  if (expiryTimer !== undefined) clearTimeout(expiryTimer);
  timer = undefined;
  expiryTimer = undefined;
}

function arm(): void {
  clearTimers();

  const now = Date.now();
  const exp = store.get(tokenExpAtom);
  if (exp !== null) {
    expiryTimer = setTimeout(
      () => {
        store.set(expiryTickAtom, (tick) => tick + 1);
      },
      Math.min(MAX_TIMEOUT_MS, Math.max(0, exp.getTime() - now)),
    );
  }

  const expiryDue = exp === null ? null : exp.getTime() - REFRESH_AHEAD_MS;
  const backoffDue = retryNotBefore === 0 ? null : retryNotBefore;
  if (expiryDue === null && backoffDue === null) return;

  const delay = Math.min(
    MAX_TIMEOUT_MS,
    Math.max(0, (expiryDue ?? 0) - now, (backoffDue ?? 0) - now, lastAttemptAt + MIN_INTERVAL_MS - now),
  );
  timer = setTimeout(() => {
    void refresh();
  }, delay);
}

function apply(result: RefreshResult): void {
  try {
    switch (result.kind) {
      case 'token':
        backoffMs = 0;
        retryNotBefore = 0;
        setToken(store, result.token);
        break;
      case 'rejected':
        backoffMs = 0;
        retryNotBefore = 0;
        setToken(store, null);
        break;
      case 'unreachable': {
        backoffMs = backoffMs === 0 ? MIN_INTERVAL_MS : Math.min(backoffMs * 2, BACKOFF_CAP_MS);
        retryNotBefore = Date.now() + backoffMs;
        break;
      }
    }
    const exp = store.get(tokenExpAtom);
    if (store.get(odbTokenAtom) !== null && (exp === null || exp.getTime() <= Date.now())) {
      if (result.kind === 'token' && exp !== null) {
        console.warn(
          `Session refresh: SSO issued a token that expired ${Math.round((Date.now() - exp.getTime()) / 1000)} s ago; this browser's clock is probably ahead of the server's.`,
        );
      }
      setToken(store, null);
    }
  } finally {
    store.set(sessionCheckedAtom, true);
    arm();
  }
}

function refresh(): Promise<void> {
  if (inFlight !== undefined) return inFlight;

  const myGeneration = generation;
  const controller = new AbortController();
  abortController = controller;
  lastAttemptAt = Date.now();

  const run = refreshSession(controller.signal)
    .then((result) => {
      if (myGeneration === generation) apply(result);
    })
    .catch((error: unknown) => {
      console.error('Session refresh: a subscriber of the token atom failed.', error);
    })
    .finally(() => {
      if (myGeneration === generation) {
        inFlight = undefined;
        abortController = undefined;
      }
    });
  inFlight = run;
  return run;
}

function cancel(): void {
  generation += 1;
  clearTimers();
  abortController?.abort();
  abortController = undefined;
  inFlight = undefined;
  backoffMs = 0;
  retryNotBefore = 0;
  lastAttemptAt = 0;
}

function teardown(): void {
  cancel();
  unsubscribe?.();
  unsubscribe = undefined;
  document.removeEventListener('visibilitychange', onVisibilityChange);
}

function onVisibilityChange(): void {
  if (document.visibilityState !== 'visible') return;
  if (Date.now() - lastAttemptAt < MIN_INTERVAL_MS) return;
  if (Date.now() < retryNotBefore) return;
  const exp = store.get(tokenExpAtom);
  if (exp !== null && Date.now() < exp.getTime() - REFRESH_AHEAD_MS) return;
  void refresh();
}

export function startSession(): () => void {
  if (unsubscribe !== undefined) teardown();
  sessionId += 1;
  const mySession = sessionId;

  unsubscribe = store.sub(odbTokenAtom, arm);
  document.addEventListener('visibilitychange', onVisibilityChange);

  if (store.get(isLoggedInAtom)) {
    store.set(sessionCheckedAtom, true);
    arm();
  } else {
    void refresh();
  }

  return () => {
    if (sessionId === mySession) teardown();
  };
}

export async function signOut(): Promise<{ reachedSso: boolean }> {
  teardown();
  try {
    setToken(store, null);
  } catch (error: unknown) {
    console.error('Sign out: a subscriber of the token atom failed.', error);
  }
  store.set(sessionCheckedAtom, true);
  try {
    await logout();
    return { reachedSso: true };
  } catch {
    return { reachedSso: false };
  }
}
