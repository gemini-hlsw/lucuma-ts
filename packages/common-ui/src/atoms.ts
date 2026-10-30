import { atom, type Store, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';

import type { User } from './auth.ts';

/*
 * Auth state shared by every app that signs in through SSO: the JWT lives in a
 * sessionStorage-backed atom and everything else — the decoded payload, user,
 * expiry, logged-in status — derives from it. App-specific policy (who may edit,
 * who may enter Admin) builds on `userAtom`/`isLoggedInAtom` in each app.
 */

const lucumaRefreshTokenKey = 'lucuma-refresh-token';

// Backed by sessionStorage; the initial value is read from storage on init.
export const odbTokenAtom = atomWithStorage<string | null>(
  lucumaRefreshTokenKey,
  null,
  createJSONStorage(() => window.sessionStorage),
  { getOnInit: true },
);

export const useOdbToken = () => useAtom(odbTokenAtom);
export const useSetOdbToken = () => useSetAtom(odbTokenAtom);
export const useOdbTokenValue = () => useAtomValue(odbTokenAtom);

export interface OdbTokenPayload {
  'lucuma-user': User;
  exp: number;
}

export const decodedTokenPayloadAtom = atom((get) => {
  const token = get(odbTokenAtom);
  const payload = token?.split('.')[1];
  if (!payload) return null;

  try {
    const decodedPayload = new TextDecoder().decode(Uint8Array.from(atob(payload), (m) => m.charCodeAt(0)));
    return JSON.parse(decodedPayload) as OdbTokenPayload;
  } catch {
    // Not a decodable JWT — treat as signed out rather than crashing the app.
    return null;
  }
});

export const userAtom = atom((get) => get(decodedTokenPayloadAtom)?.['lucuma-user'] ?? null);
export const useUser = () => useAtomValue(userAtom);

export const tokenExpAtom = atom((get) => {
  const exp = get(decodedTokenPayloadAtom)?.exp;
  return exp ? new Date(exp * 1000) : null;
});
export const useTokenExp = () => useAtomValue(tokenExpAtom);

export const isLoggedInAtom = atom((get) => {
  const user = get(userAtom);
  const exp = get(tokenExpAtom);
  // There is a user and the token is not expired.
  return user !== null && (exp ? exp > new Date() : false);
});
export const useIsLoggedIn = () => useAtomValue(isLoggedInAtom);

/* Session state, written by the session keeper (session.ts). */

/** True once the keeper has checked the session with SSO, or found a live token. */
export const sessionCheckedAtom = atom(false);

/** True when another tab signed out this tab. A new token clears it. */
export const signedOutElsewhereAtom = atom(false);
export const useSignedOutElsewhere = () => useAtomValue(signedOutElsewhereAtom);

/** `checking` until the first answer, so a returning reader does not see a signed-out screen. */
export type SessionStatus = 'checking' | 'signed-out' | 'signed-in';

export const sessionStatusAtom = atom<SessionStatus>((get) => {
  if (get(isLoggedInAtom)) return 'signed-in';
  return get(sessionCheckedAtom) ? 'signed-out' : 'checking';
});
export const useSessionStatus = () => useAtomValue(sessionStatusAtom);

/** Hold `token` (or null to sign out) in `store`. A storage error (quota, private mode)
 *  keeps the token for this tab. An AggregateError from a failing subscriber is rethrown. */
export function setToken(store: Store, token: string | null): void {
  if (token !== null) store.set(signedOutElsewhereAtom, false);
  try {
    store.set(odbTokenAtom, token);
  } catch (error) {
    if (error instanceof AggregateError) throw error;
  }
}
