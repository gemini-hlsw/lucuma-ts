/*
 * GPP deployment environments shared by every SSO-backed app. Each app maps its
 * hostnames to entries built with `ssoEnvironment`, so each SSO origin is set once.
 */

export type EnvironmentName = 'development' | 'staging' | 'production';

/** The SSO service each environment signs in through. */
const SSO_URIS = {
  development: 'https://sso-dev.gpp.gemini.edu',
  staging: 'https://sso-test.gpp.gemini.edu',
  production: 'https://sso.gpp.gemini.edu',
} as const satisfies Record<EnvironmentName, string>;

/** Build-version suffix for each environment, as in Explore's `DATE-COMMIT-ENV`
 *  scheme. A new environment fails to compile until it has a suffix. */
export const VERSION_SUFFIX = {
  development: 'DEV',
  staging: 'STAGING',
  production: 'PROD',
} as const satisfies Record<EnvironmentName, string>;

/** The part of an environment entry shared by every app. */
export interface SsoEnvironment {
  readonly name: EnvironmentName;
  readonly ssoUri: string;
}

export function ssoEnvironment(name: EnvironmentName): SsoEnvironment {
  return { name, ssoUri: SSO_URIS[name] };
}

/** Returns the entry for `hostname`. Unlisted hosts (dev-server aliases, previews)
 *  use `fallbackKey`, and so do inherited names such as `constructor`. */
export function resolveEnvironment<E, K extends string>(
  table: Readonly<Record<K, E>>,
  hostname: string,
  fallbackKey: NoInfer<K>,
): E {
  return Object.hasOwn(table, hostname) ? table[hostname as K] : table[fallbackKey];
}
