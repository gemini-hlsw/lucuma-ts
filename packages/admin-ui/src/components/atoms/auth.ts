import { isLoggedInAtom, userAtom } from '@gemini-hlsw/lucuma-common-ui';
import { atom, useAtomValue } from 'jotai';

import { canAccessAdmin } from '@/auth/user';

/*
 * The token and derived auth atoms live in common-ui so all apps share them
 * (re-exported here to keep the `@/components/atoms/auth` import path stable).
 * Only the Admin-specific access gate stays local.
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

/** Staff or better — whether the Admin app renders at all (the ODB and SSO
 *  enforce the same bar on every admin operation server-side). */
export const canAccessAdminAtom = atom((get) => get(isLoggedInAtom) && canAccessAdmin(get(userAtom)));
export const useCanAccessAdmin = () => useAtomValue(canAccessAdminAtom);
