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

/** True once another tab's logout ended this tab's session, until a token arrives. */
export const signedOutElsewhereAtom = atom(false);

export const useSignedOutElsewhere = () => useAtomValue(signedOutElsewhereAtom);

export type SessionStatus = 'checking' | 'signed-out' | 'signed-in';

export const sessionStatusAtom = atom<SessionStatus>((get) => {
  if (get(isLoggedInAtom)) return 'signed-in';
  return get(sessionCheckedAtom) ? 'signed-out' : 'checking';
});

export const useSessionStatus = () => useAtomValue(sessionStatusAtom);

export function setToken(store: ReturnType<typeof createStore>, token: string | null): void {
  if (token !== null) store.set(signedOutElsewhereAtom, false);
  try {
    store.set(odbTokenAtom, token);
  } catch (error) {
    if (error instanceof AggregateError) throw error;
  }
}
