/*
 * SSO endpoint operations for the Admin app. The transport lives in common-ui
 * (@gemini-hlsw/lucuma-common-ui/sso); this module binds it to the Admin
 * environment's SSO origin so callers don't pass it every time. The SSO session
 * cookie is scoped to its own domain, so these flows complete on the deployed
 * hosts and on any *.lucuma.xyz dev alias, but not from bare localhost (see the
 * README).
 */
import * as sso from '@gemini-hlsw/lucuma-common-ui/sso';

import { CURRENT_ENV } from './environments';

/** Exchange the SSO session cookie for a fresh JWT, or null when signed out. */
export const refreshToken = (signal?: AbortSignal): Promise<string | null> =>
  sso.refreshToken(CURRENT_ENV.ssoUri, signal);

/** Guest token (no ORCID). A guest cannot pass the Admin role gate — offered so
 *  the gate can demonstrate the denial honestly rather than erroring. */
export const guestLogin = (): Promise<string | null> => sso.guestLogin(CURRENT_ENV.ssoUri);

/** The ORCID sign-in URL; navigating here begins the login redirect. */
export const signInUrl = (returnTo: string = window.location.href): string =>
  sso.signInUrl(CURRENT_ENV.ssoUri, returnTo);

/** Switch to one of the user's other roles and return the fresh token. Throws
 *  when SSO rejects the switch or is unreachable. */
export const setRole = (roleId: string): Promise<string> => sso.setRole(CURRENT_ENV.ssoUri, roleId);

/** End the SSO session. Throws when SSO rejects the call or is unreachable. */
export const logout = (): Promise<void> => sso.logout(CURRENT_ENV.ssoUri);
