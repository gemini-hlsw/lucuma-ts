import { isLoggedInAtom, userAtom } from '@gemini-hlsw/lucuma-common-ui';
import { atom, useAtomValue } from 'jotai';

import { canAccessAdmin } from '@/auth/user';

/*
 * The token and derived auth atoms live in common-ui so all apps share them
 * (re-exported here to keep the `@/components/atoms/auth` import path stable).
 * Only the Admin-specific access gate and the signing-out flag stay local.
 */

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

/** True from the click on Sign out until SSO has answered. SSO's logout does not end the session on its
 *  server: it only clears the cookie in the browser once its response arrives, so a silent sign-in sent
 *  before then still carries the cookie and is answered with a fresh token. While this is set that sign-in
 *  does nothing (sc-10853). */
export const signingOutAtom = atom(false);
export const useSigningOut = () => useAtomValue(signingOutAtom);

/** Staff or better — whether the Admin app renders at all (the ODB and SSO
 *  enforce the same bar on every admin operation server-side). */
export const canAccessAdminAtom = atom((get) => get(isLoggedInAtom) && canAccessAdmin(get(userAtom)));
export const useCanAccessAdmin = () => useAtomValue(canAccessAdminAtom);
