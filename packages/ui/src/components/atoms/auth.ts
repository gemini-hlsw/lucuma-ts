import { isLoggedInAtom, userAtom } from '@gemini-hlsw/lucuma-common-ui';
import { atom, useAtomValue } from 'jotai';

/*
 * The token and derived auth atoms live in common-ui so all apps share them
 * (re-exported here to keep the `@/components/atoms/auth` import path stable).
 * Only navigate's own edit-permission gate stays local.
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
