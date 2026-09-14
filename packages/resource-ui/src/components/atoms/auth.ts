/*
 * The session atoms live in common-ui, so every app that signs in through SSO
 * shares one definition. This module is the app's single import path for them, so
 * app-specific policy (who may edit what) can later land beside them without
 * moving any call site.
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
