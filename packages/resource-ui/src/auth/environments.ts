/*
 * Per-environment service endpoints, resolved from the hostname at runtime, so a
 * staging bundle can never reach a development endpoint.
 *
 * `ssoUri` is always absolute, never a dev-server proxy path: the SSO flows are
 * cookie-based, and a cookie scoped to SSO's own domain is not sent to an origin
 * that merely forwards to it.
 */

export interface Environment {
  readonly name: 'development' | 'staging';
  readonly ssoUri: string;
}

const DEV: Environment = {
  name: 'development',
  ssoUri: 'https://sso-dev.gpp.lucuma.xyz',
};

const STAGING: Environment = {
  name: 'staging',
  ssoUri: 'https://sso-test.gpp.gemini.edu',
};

const environments = {
  'resource-dev.lucuma.xyz': DEV,
  'resource-staging.lucuma.xyz': STAGING,
} satisfies Record<string, Environment>;

/** Everything that is not a deployed host - localhost, dev-server aliases,
 *  previews - is development. */
export function environmentFor(hostname: string): Environment {
  return environments[hostname as keyof typeof environments] ?? DEV;
}

export const CURRENT_ENV: Environment = environmentFor(window.location.hostname);

/** How many seconds before token expiry to proactively refresh. */
export const EXPIRATION_ANTICIPATION_SECONDS = 30;
