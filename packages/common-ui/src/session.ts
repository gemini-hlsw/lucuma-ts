import type { Store } from 'jotai';

import {
  isLoggedInAtom,
  odbTokenAtom,
  sessionCheckedAtom,
  setToken,
  signedOutElsewhereAtom,
  tokenExpAtom,
  userAtom,
} from './atoms.ts';
import type { StandardRole, User } from './auth.ts';
import { logout, REFRESH_TIMEOUT_MS, type RefreshResult, refreshSession, setActiveRole } from './sso.ts';

/*
 * The SSO session keeper that every app shares. It signs in from the SSO cookie,
 * renews the token before it expires, and signs all tabs out together.
 * Create it with `createSession` or `sessionPerStore`. Start it with `useSessionKeeper`.
 */

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

/** What a keeper posts on its channel when this tab signs out. */
export const SIGNED_OUT_MESSAGE = 'signed-out';

type RoleType = StandardRole['type'];

/** What a role policy asks for. `unavailable` means the user holds no preferred role. */
export type RolePlan =
  | { readonly kind: 'keep' }
  | { readonly kind: 'switch'; readonly role: StandardRole }
  | { readonly kind: 'unavailable'; readonly active: StandardRole };

const KEEP: RolePlan = { kind: 'keep' };

/** Plan the role switch. A standard user whose active role is not in `preferRoles`
 *  switches to the first of their `otherRoles` that is. Others keep their role. */
export function planRoleSwitch(user: User | null, preferRoles: readonly RoleType[]): RolePlan {
  if (user?.type !== 'standard' || preferRoles.length === 0) return KEEP;
  if (preferRoles.includes(user.role.type)) return KEEP;
  const role = user.otherRoles.find((other) => preferRoles.includes(other.type));
  return role ? { kind: 'switch', role } : { kind: 'unavailable', active: user.role };
}

/** How a role switch ended. `failed` covers an SSO refusal, a timeout, or no token for the new role. */
export type RoleSwitchOutcome =
  | { readonly kind: 'switched'; readonly role: StandardRole }
  | { readonly kind: 'failed'; readonly role: StandardRole; readonly error: Error };

export interface SessionOptions {
  readonly store: Store;
  /** The SSO origin, or a function read at each call (for an origin known only at runtime). */
  readonly ssoUri: string | (() => string);
  /** BroadcastChannel name for sign-out messages. Use a unique name per app, so a
   *  sign-out reaches only that app's tabs. */
  readonly channelName: string;
  /** Roles the app wants active; see `planRoleSwitch`. A user is switched at
   *  most once per token. Omit for no automatic switch. */
  readonly preferRoles?: readonly RoleType[];
}

export interface StartOptions {
  readonly timings?: SessionTimings | undefined;
  readonly onRoleSwitch?: ((outcome: RoleSwitchOutcome) => void) | undefined;
}

/** Its functions hold no `this`, so they can be passed around detached. */
export interface Session {
  readonly store: Store;
  /** Start the keeper and return its stop. A new start replaces the running keeper, so an old
   *  stop does nothing. */
  readonly start: (options?: StartOptions) => () => void;
  /** Sign out every tab of the app, then end the SSO session. The local sign-out
   *  happens even when SSO does not answer. */
  readonly signOut: () => Promise<{ reachedSso: boolean }>;
  /** Hold a token from outside the keeper, such as a guest login. Restarts the keeper
   *  when a sign-out stopped it while mounted. */
  readonly signIn: (token: string) => void;
  /** Switch the active role at the reader's request. Waits for any refresh in flight, so an old
   *  token cannot replace the new one. Does not call `onRoleSwitch`. */
  readonly switchRole: (role: StandardRole) => Promise<RoleSwitchOutcome>;
  /** Settles once the refresh in flight (if any) has been applied. */
  readonly pendingRefresh: () => Promise<void>;
}

export function createSession({ store, ssoUri, channelName, preferRoles = [] }: SessionOptions): Session {
  const resolveSsoUri = typeof ssoUri === 'string' ? () => ssoUri : ssoUri;

  let timings = SESSION_TIMINGS;
  let onRoleSwitch: StartOptions['onRoleSwitch'];
  /** Bumped by each start, so only the latest start's stop tears down. */
  let sessionId = 0;
  /** True until the start's stop runs. A sign-out keeps it true, so `signIn` can restart. */
  let mounted = false;
  /** Bumped on each boot or teardown. Async work drops its result when this changes. */
  let generation = 0;
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
  let roleCheckedFor: string | null = null;
  let switchingIn: number | null = null;
  let switchAbort: AbortController | undefined;

  const pendingRefresh = (): Promise<void> => inFlight ?? Promise.resolve();

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
    expiryTimer = setTimeout(
      expireToken,
      Math.min(timings.maxTimerMs, Math.max(0, (exp?.getTime() ?? 0) - Date.now())),
    );
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
    // With no token, keep the old deadline, so the waiting refresh still runs.
    if (store.get(odbTokenAtom) !== null) {
      refreshDueAt = exp !== null && exp.getTime() > now ? exp.getTime() - timings.refreshAheadMs : null;
    }
    if (refreshDueAt === null && retryNotBefore === 0) return;

    const delay = Math.min(
      timings.maxTimerMs,
      Math.max(0, (refreshDueAt ?? 0) - now, retryNotBefore - now, lastAttemptAt + timings.minIntervalMs - now),
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

  function askSso(signal: AbortSignal): Promise<RefreshResult> {
    try {
      return refreshSession(resolveSsoUri(), signal, timings.refreshTimeoutMs);
    } catch (error: unknown) {
      console.error('Session refresh: the SSO origin is not known.', error);
      return Promise.resolve({ kind: 'unreachable' });
    }
  }

  function refresh(): Promise<void> {
    if (inFlight !== undefined) return inFlight;

    const controller = new AbortController();
    abortController = controller;
    lastAttemptAt = Date.now();

    const run = askSso(controller.signal)
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

  function report(outcome: RoleSwitchOutcome | null): void {
    if (outcome === null) return;
    try {
      onRoleSwitch?.(outcome);
    } catch (error: unknown) {
      console.error('Session role switch: the onRoleSwitch callback failed.', error);
    }
  }

  const failed = (role: StandardRole, error: unknown): RoleSwitchOutcome => ({
    kind: 'failed',
    role,
    error: error instanceof Error ? error : new Error(String(error)),
  });

  /** Switch to `role` and hold its token. Resolves null if the keeper stops, signs out
   *  or restarts first. */
  async function changeRole(role: StandardRole): Promise<RoleSwitchOutcome | null> {
    const mine = generation;
    const live = (): boolean => generation === mine;
    switchingIn = mine;
    const controller = new AbortController();
    switchAbort = controller;
    // Times out like a refresh, so an unanswered switch cannot block role checks.
    const deadline = setTimeout(() => {
      controller.abort(new DOMException('SSO did not answer the role switch in time.', 'TimeoutError'));
    }, timings.refreshTimeoutMs);
    try {
      try {
        await setActiveRole(resolveSsoUri(), role.id, controller.signal);
      } catch (error: unknown) {
        return live() ? failed(role, error) : null;
      } finally {
        clearTimeout(deadline);
      }
      // A refresh in flight predates the switch. Wait for it, then refresh for the new role.
      if (live()) await pendingRefresh();
      if (live()) await refresh();
      if (!live()) return null;

      const user = store.get(userAtom);
      return user?.type === 'standard' && user.role.id === role.id
        ? { kind: 'switched', role }
        : failed(role, new Error('SSO accepted the role switch but returned no token for it.'));
    } finally {
      if (switchingIn === mine) switchingIn = null;
      if (switchAbort === controller) switchAbort = undefined;
    }
  }

  async function switchRole(role: StandardRole): Promise<RoleSwitchOutcome> {
    if (unsubscribe === undefined) return failed(role, new Error('The session is not running.'));
    return (await changeRole(role)) ?? failed(role, new Error('The session ended before the role switch finished.'));
  }

  function checkRole(): void {
    const token = store.get(odbTokenAtom);
    if (token === null || token === roleCheckedFor) return;
    roleCheckedFor = token;
    // A token that arrives mid-switch is that switch's answer. Checking it again could loop.
    if (switchingIn === generation) return;
    const plan = planRoleSwitch(store.get(userAtom), preferRoles);
    if (plan.kind === 'switch') void changeRole(plan.role).then(report);
  }

  function onToken(): void {
    arm();
    checkRole();
  }

  function cancel(): void {
    clearTimers();
    abortController?.abort();
    abortController = undefined;
    switchAbort?.abort();
    switchAbort = undefined;
    inFlight = undefined;
    backoffMs = 0;
    retryNotBefore = 0;
    refreshDueAt = null;
    lastAttemptAt = 0;
  }

  function boot(): void {
    generation += 1;
    roleCheckedFor = null;
    unsubscribe = store.sub(odbTokenAtom, onToken);
    document.addEventListener('visibilitychange', onVisibilityChange);
    channel = new BroadcastChannel(channelName);
    channel.addEventListener('message', onSignedOutElsewhere);

    if (store.get(isLoggedInAtom)) {
      store.set(sessionCheckedAtom, true);
    } else {
      void refresh();
    }
    arm();
    checkRole();
  }

  function teardown(): void {
    generation += 1;
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

  function start({ timings: startTimings = SESSION_TIMINGS, onRoleSwitch: listener }: StartOptions = {}): () => void {
    if (unsubscribe !== undefined) teardown();
    timings = startTimings;
    onRoleSwitch = listener;
    sessionId += 1;
    const mySession = sessionId;
    mounted = true;
    boot();

    return () => {
      if (sessionId !== mySession) return;
      mounted = false;
      onRoleSwitch = undefined;
      teardown();
    };
  }

  async function signOut(): Promise<{ reachedSso: boolean }> {
    const announced = channel !== undefined;
    channel?.postMessage(SIGNED_OUT_MESSAGE);
    endSession('Sign out');
    try {
      await logout(resolveSsoUri());
      return { reachedSso: true };
    } catch {
      return { reachedSso: false };
    } finally {
      // A tab loaded during logout missed the first post, and may have renewed. Post again.
      if (announced) {
        const late = new BroadcastChannel(channelName);
        late.postMessage(SIGNED_OUT_MESSAGE);
        late.close();
      }
    }
  }

  function signIn(token: string): void {
    setToken(store, token);
    if (mounted && unsubscribe === undefined) boot();
  }

  return { store, start, signOut, signIn, switchRole, pendingRefresh };
}

/** One keeper per Jotai store, created on first use. `options` runs only then, with the
 *  caller's extra arguments. A test's own store gets its own keeper. */
export function sessionPerStore<A extends unknown[]>(
  options: (...args: A) => Omit<SessionOptions, 'store'>,
): (store: Store, ...args: A) => Session {
  const sessions = new WeakMap<Store, Session>();
  return (store, ...args) => {
    let session = sessions.get(store);
    if (session === undefined) {
      session = createSession({ ...options(...args), store });
      sessions.set(store, session);
    }
    return session;
  };
}
