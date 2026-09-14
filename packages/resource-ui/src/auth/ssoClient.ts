/*
 * The SSO session cookie is scoped to its own domain, so these flows complete on
 * the deployed hosts and on any *.lucuma.xyz dev alias, but not from bare
 * localhost.
 */
import * as sso from '@gemini-hlsw/lucuma-common-ui/sso';

import { CURRENT_ENV } from './environments';

/** Exchange the SSO session cookie for a fresh JWT; null when signed out or the
 *  refresh fails. */
export const refreshToken = (signal?: AbortSignal): Promise<string | null> =>
  sso.refreshToken(CURRENT_ENV.ssoUri, signal);

/** The ORCID sign-in URL; navigating here begins the login redirect. */
export const signInUrl = (returnTo: string = window.location.href): string =>
  sso.signInUrl(CURRENT_ENV.ssoUri, returnTo);

/** End the SSO session. Throws when SSO rejects the call or is unreachable. */
export const logout = (): Promise<void> => sso.logout(CURRENT_ENV.ssoUri);
