import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';
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
