import { isLoggedInAtom, odbTokenAtom, userAtom } from '@gemini-hlsw/lucuma-common-ui';
import { atom, type Store, useAtomValue } from 'jotai';

export {
  decodedTokenPayloadAtom,
  isLoggedInAtom,
  odbTokenAtom,
  type OdbTokenPayload,
  tokenExpAtom,
  userAtom,
} from '@gemini-hlsw/lucuma-common-ui';

export const useUser = () => ({ user: useAtomValue(userAtom) });

export const sessionCheckedAtom = atom(false);

/** How the last session the gate opened ended, until a token arrives; `none` earns no notice. */
export type SessionEnding =
  'none' | 'logging-out' | 'logged-out' | 'logout-missed-sso' | 'logged-out-elsewhere' | 'lapsed';

export const sessionEndingAtom = atom<SessionEnding>('none');

export const useSessionEnding = () => ({ ending: useAtomValue(sessionEndingAtom) });

export type SessionStatus = 'checking' | 'signed-out' | 'signed-in';

export const sessionStatusAtom = atom<SessionStatus>((get) => {
  if (get(isLoggedInAtom)) return 'signed-in';
  return get(sessionCheckedAtom) ? 'signed-out' : 'checking';
});

export const useSessionStatus = () => ({ status: useAtomValue(sessionStatusAtom) });

export function setToken(store: Store, token: string | null): void {
  if (token !== null) store.set(sessionEndingAtom, 'none');
  try {
    store.set(odbTokenAtom, token);
  } catch (error) {
    if (error instanceof AggregateError) throw error;
  }
}
