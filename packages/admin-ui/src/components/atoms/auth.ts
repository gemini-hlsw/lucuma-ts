import { atom, useAtomValue, useSetAtom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';

import { canAccessAdmin, type User } from '@/auth/user';

/*
 * Auth state, following packages/ui/src/components/atoms/auth.ts: the SSO JWT
 * lives in a sessionStorage-backed atom and everything else — user, expiry,
 * admin access — derives from decoding it. The Apollo link and the SSO client
 * read the token through the shared store; components use the hooks.
 */

const lucumaRefreshTokenKey = 'lucuma-refresh-token';

export const odbTokenAtom = atomWithStorage<string | null>(
  lucumaRefreshTokenKey,
  null,
  createJSONStorage(() => window.sessionStorage),
  { getOnInit: true },
);

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
  // There is a user and the token is not expired
  return user !== null && (exp ? exp > new Date() : false);
});
export const useIsLoggedIn = () => useAtomValue(isLoggedInAtom);

/** Staff or better — whether the Admin app renders at all (the ODB and SSO
 *  enforce the same bar on every admin operation server-side). */
export const canAccessAdminAtom = atom((get) => get(isLoggedInAtom) && canAccessAdmin(get(userAtom)));
export const useCanAccessAdmin = () => useAtomValue(canAccessAdminAtom);
