/*
 * SSO endpoint operations for the Admin app. The transport lives in common-ui
 * (@gemini-hlsw/lucuma-common-ui/sso); this module binds it to the Admin
 * environment's SSO origin, so callers do not pass it. The session keeper
 * (./session.ts) handles refresh, role switches and logout. The SSO session
 * cookie is scoped to its own domain, so these flows complete on the deployed
 * hosts and on any *.gemini.edu dev alias, but not from bare localhost (see the
 * README).
 */
import * as sso from '@gemini-hlsw/lucuma-common-ui/sso';

import { CURRENT_ENV } from './environments';

/** Guest token (no ORCID). A guest cannot pass the Admin role gate — offered so
 *  the gate can demonstrate the denial honestly rather than erroring. */
export const guestLogin = (): Promise<string | null> => sso.guestLogin(CURRENT_ENV.ssoUri);

/** The ORCID sign-in URL; navigating here begins the login redirect. */
export const signInUrl = (returnTo: string = window.location.href): string =>
  sso.signInUrl(CURRENT_ENV.ssoUri, returnTo);
