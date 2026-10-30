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
import {
  type EnvironmentName,
  resolveEnvironment,
  type SsoEnvironment,
  ssoEnvironment,
} from '@gemini-hlsw/lucuma-common-ui';

export interface Environment extends SsoEnvironment {
  readonly odbUri: string;
  /** SSO's GraphQL endpoint (the Users view's roster + role mutations). */
  readonly ssoGraphqlUri: string;
  /** Explore, the science UI — Admin links program references to it so a
   *  reviewer can open the program (sc-10159). Matched to this environment so a
   *  reviewer is never sent to a program from another one. Hosts come from
   *  Explore's own environments.conf.json, where explore-test.gemini.edu is the
   *  STAGING deployment (an unlisted host falls through to DEVELOPMENT). */
  readonly exploreUri: string;
}

/** The shared SSO base plus its GraphQL endpoint. The SSO origin is set only in
 *  common-ui. */
const ssoBase = (name: EnvironmentName): Pick<Environment, 'name' | 'ssoUri' | 'ssoGraphqlUri'> => {
  const base = ssoEnvironment(name);
  return { ...base, ssoGraphqlUri: `${base.ssoUri}/graphql` };
};

const DEV: Environment = {
  ...ssoBase('development'),
  odbUri: 'https://lucuma-postgres-odb-dev.herokuapp.com/odb',
  exploreUri: 'https://explore-dev.gemini.edu',
};

const STAGING: Environment = {
  ...ssoBase('staging'),
  odbUri: 'https://lucuma-postgres-odb-staging.herokuapp.com/odb',
  exploreUri: 'https://explore-test.gemini.edu',
};

const PRODUCTION: Environment = {
  ...ssoBase('production'),
  odbUri: 'https://lucuma-postgres-odb-production.herokuapp.com/odb',
  exploreUri: 'https://explore.gemini.edu',
};

/** DEV, with the ODB and SSO GraphQL behind the Vite proxies (vite.config.ts),
 *  so requests need no CORS. Explore is a separate app, so it is not proxied. */
const LOCAL_DEV: Environment = {
  ...DEV,
  odbUri: '/odb',
  ssoGraphqlUri: '/sso-graphql',
};

const ENVIRONMENTS = {
  'admin-dev.gemini.edu': DEV,
  'admin-test.gemini.edu': STAGING,
  'admin.gemini.edu': PRODUCTION,
  localhost: LOCAL_DEV,
} satisfies Record<string, Environment>;

/** The environment a hostname resolves to; unknown hosts (dev-server
 *  aliases, previews) fall through to the proxied local-dev entry. */
export const environmentFor = (hostname: string): Environment =>
  resolveEnvironment(ENVIRONMENTS, hostname, 'localhost');

export const CURRENT_ENV: Environment = environmentFor(window.location.hostname);
