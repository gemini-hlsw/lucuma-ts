/*
 * Per-environment service endpoints, resolved from the hostname at runtime —
 * the resource-ui pattern (see its ApolloConfigs.ts). Dev-server hosts fall
 * through to the localhost entry, whose relative URIs are served by the Vite
 * proxies in vite.config.ts; deployed hosts resolve to their real services, so
 * no development endpoint can ever reach a production bundle.
 *
 * SSO is listed alongside the ODB because the Admin app talks to both: the
 * cookie-based auth flows (login redirect, token refresh, role switch) must
 * target SSO's absolute origin, and the Users view queries SSO's GraphQL.
 */

export interface Environment {
  readonly name: 'development' | 'staging' | 'production';
  readonly ssoUri: string;
  readonly odbUri: string;
  /** SSO's GraphQL endpoint (the Users view's roster + role mutations). */
  readonly ssoGraphqlUri: string;
}

const DEV: Environment = {
  name: 'development',
  ssoUri: 'https://sso-dev.gpp.lucuma.xyz',
  odbUri: 'https://lucuma-postgres-odb-dev.herokuapp.com/odb',
  ssoGraphqlUri: 'https://sso-dev.gpp.lucuma.xyz/graphql',
};

const STAGING: Environment = {
  name: 'staging',
  ssoUri: 'https://sso-test.gpp.gemini.edu',
  odbUri: 'https://lucuma-postgres-odb-staging.herokuapp.com/odb',
  ssoGraphqlUri: 'https://sso-test.gpp.gemini.edu/graphql',
};

const PRODUCTION: Environment = {
  name: 'production',
  ssoUri: 'https://sso.gpp.gemini.edu',
  odbUri: 'https://lucuma-postgres-odb-production.herokuapp.com/odb',
  ssoGraphqlUri: 'https://sso.gpp.gemini.edu/graphql',
};

const LOCAL_DEV: Environment = {
  name: 'development',
  ssoUri: DEV.ssoUri,
  // Vite proxies (vite.config.ts) — same-origin in dev, so no CORS.
  odbUri: '/odb',
  ssoGraphqlUri: '/sso-graphql',
};

const environments = {
  'admin-dev.lucuma.xyz': DEV,
  'admin-staging.lucuma.xyz': STAGING,
  'admin.gemini.edu': PRODUCTION,
  localhost: LOCAL_DEV,
} satisfies Record<string, Environment>;

/** The environment a hostname resolves to; unknown hosts (dev-server
 *  aliases, previews) fall through to the proxied local-dev entry. */
export function environmentFor(hostname: string): Environment {
  return environments[hostname as keyof typeof environments] ?? LOCAL_DEV;
}

export const CURRENT_ENV: Environment = environmentFor(window.location.hostname);

/** How many seconds before token expiry to proactively refresh. */
export const EXPIRATION_ANTICIPATION_SECONDS = 30;
