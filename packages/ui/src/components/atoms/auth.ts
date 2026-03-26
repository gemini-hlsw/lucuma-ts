import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';

import type { User } from '@/auth/user';

const lucumaRefreshTokenKey = 'lucuma-refresh-token';
const initialStoredLucumaRefreshToken = sessionStorage.getItem(lucumaRefreshTokenKey);

// Atom backed by sessionStorage, default value is retrieved from sessionStorage
export const odbTokenAtom = atomWithStorage(
  lucumaRefreshTokenKey,
  initialStoredLucumaRefreshToken ? (JSON.parse(initialStoredLucumaRefreshToken) as string) : null,
  createJSONStorage(() => window.sessionStorage),
);

export const useOdbToken = () => useAtom(odbTokenAtom);
export const useSetOdbToken = () => useSetAtom(odbTokenAtom);
export const useOdbTokenValue = () => useAtomValue(odbTokenAtom);

// Below are all atoms derived from the odbTokenAtom

export interface OdbTokenPayload {
  'lucuma-user': User;
  exp: number;
}

export const decodedTokenPayloadAtom = atom((get) => {
  const token = get(odbTokenAtom);
  if (!token) return null;

  const payload = token.split('.')?.[1];
  if (!payload) return null;

  const decodedPayload = new TextDecoder().decode(Uint8Array.from(atob(payload), (m) => m.charCodeAt(0)));

  return JSON.parse(decodedPayload) as OdbTokenPayload;
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

export const canEditAtom = atom((get) => {
  const isLoggedIn = get(isLoggedInAtom);
  if (!isLoggedIn) {
    return false;
  }

  const user = get(userAtom);
  switch (user?.type) {
    case 'standard':
      return ['staff', 'admin'].includes(user.role.type);
    case 'service':
      return true;
    case 'guest':
      return false;
    default:
      return false;
  }
});
export const useCanEdit = () => useAtomValue(canEditAtom);
