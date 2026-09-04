import { ApolloClient, ApolloLink, HttpLink, InMemoryCache } from '@apollo/client';
import { SetContextLink } from '@apollo/client/link/context';
import { withAbsoluteUri } from '@gemini-hlsw/lucuma-common-ui';

import { CURRENT_ENV } from '@/auth/environments';
import { odbTokenAtom } from '@/components/atoms/auth';
import { store } from '@/components/atoms/store';

/*
 * One Apollo client fronting the app's two GraphQL endpoints, split on the
 * operation's `clientName` context (the navigate-ui pattern): operations with
 * `clientName: 'sso'` (gql/sso/) go to the SSO GraphQL endpoint; everything
 * else goes to the ODB. Both endpoints come from the hostname-resolved
 * environment (dev/staging/production, or the Vite proxy in local dev — see
 * auth/environments.ts), and every request carries the signed-in user's token
 * as a bearer, read from the shared Jotai store per request so a fresh
 * sign-in takes effect without a reload. With no token the request goes out
 * without an Authorization header and the server denies it — the auth gate
 * keeps users from getting that far.
 */

const authLink = new SetContextLink((prevContext) => {
  const token = store.get(odbTokenAtom);
  // Apollo types operation context values as `any`; pin the headers shape.
  const prevHeaders = (prevContext.headers ?? {}) as Record<string, string>;
  return {
    headers: token ? { ...prevHeaders, Authorization: `Bearer ${token}` } : prevHeaders,
  };
});

const endpointLink = ApolloLink.split(
  (operation) => operation.getContext().clientName === 'sso',
  new HttpLink({ uri: withAbsoluteUri(CURRENT_ENV.ssoGraphqlUri) }),
  new HttpLink({ uri: withAbsoluteUri(CURRENT_ENV.odbUri) }),
);

export const client = new ApolloClient({
  clientAwareness: {
    name: 'admin-ui',
    version: import.meta.env.FRONTEND_VERSION,
  },
  link: authLink.concat(endpointLink),
  cache: new InMemoryCache(),
  // Render the data the ODB did return, even when the response also carries
  // GraphQL errors. The admin lists select each observation's execution digest,
  // which the ODB computes per observation and reports as a partial-success
  // *warning* (null value + an entry in `errors`) when a single observation
  // can't be costed — e.g. a GHOST high-resolution target with no sky position,
  // or an observation missing an observing mode. Under Apollo's default
  // `errorPolicy: 'none'` one such warning discards the *entire* result, blanking
  // the whole tab (sc-10153); `'all'` keeps the good rows and lets the affected
  // ones fall back to "—". Applied to reads only — `mutate` keeps the default
  // `'none'` so failed mutations still reject and the views' try/catch handling
  // (and "…failed" toasts) keep working.
  defaultOptions: {
    watchQuery: { errorPolicy: 'all' },
    query: { errorPolicy: 'all' },
  },
});
