import { isLoggedInAtom, odbTokenAtom, tokenExpAtom } from '@gemini-hlsw/lucuma-common-ui';
import { atom, type createStore, useAtomValue } from 'jotai';

export {
  decodedTokenPayloadAtom,
  isLoggedInAtom,
  odbTokenAtom,
  type OdbTokenPayload,
  tokenExpAtom,
  useIsLoggedIn,
  useOdbToken,
  useOdbTokenValue,
  userAtom,
  useSetOdbToken,
  useTokenExp,
  useUser,
} from '@gemini-hlsw/lucuma-common-ui';

export const sessionCheckedAtom = atom(false);

export const expiryTickAtom = atom(0);

export type SessionStatus = 'checking' | 'signed-out' | 'signed-in';

// isLoggedInAtom memoizes its clock comparison, so the tick and a live check are what expire the status.
export const sessionStatusAtom = atom<SessionStatus>((get) => {
  get(expiryTickAtom);
  const exp = get(tokenExpAtom);
  if (get(isLoggedInAtom) && exp !== null && exp.getTime() > Date.now()) return 'signed-in';
  return get(sessionCheckedAtom) ? 'signed-out' : 'checking';
});

export const useSessionStatus = () => useAtomValue(sessionStatusAtom);

export function setToken(store: ReturnType<typeof createStore>, token: string | null): void {
  try {
    store.set(odbTokenAtom, token);
  } catch (error) {
    if (error instanceof AggregateError) throw error;
  }
}
