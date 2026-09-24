import { isLoggedInAtom, odbTokenAtom } from '@gemini-hlsw/lucuma-common-ui';
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

export type SessionStatus = 'checking' | 'signed-out' | 'signed-in';

export const sessionStatusAtom = atom<SessionStatus>((get) => {
  if (get(isLoggedInAtom)) return 'signed-in';
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
