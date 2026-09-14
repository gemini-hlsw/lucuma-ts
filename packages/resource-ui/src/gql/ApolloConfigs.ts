import { ApolloClient, ApolloLink, HttpLink } from '@apollo/client';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { SetContextLink } from '@apollo/client/link/context';
import { ErrorLink } from '@apollo/client/link/error';
import { Observable } from '@apollo/client/utilities';
import { withAbsoluteUri } from '@gemini-hlsw/lucuma-common-ui';

import { odbTokenAtom } from '@/components/atoms/auth';
import { store } from '@/components/atoms/store';

import { buildCache } from './cache';
import { clearLiveFailure, reportLiveFailure } from './liveStatus';

const graphqlEndpoints = {
  'resource-dev.lucuma.xyz': 'https://lucuma-resource-dev.lucuma.xyz/resource/graphql',
  'resource-staging.lucuma.xyz': 'https://lucuma-resource-staging.lucuma.xyz/resource/graphql',
  localhost: '/resource/graphql',
} satisfies Record<string, string>;

const defaultGraphqlEndpoint = graphqlEndpoints.localhost;

/** The live endpoint this serving resolves to. Exported for the About dialog. */
export const liveGraphqlEndpoint =
  graphqlEndpoints[window.location.hostname as keyof typeof graphqlEndpoints] ?? defaultGraphqlEndpoint;

/** GraphQL errors mean the server answered but not this API; anything else is no answer at all. */
export const liveFailureMessage = (error: unknown): string => {
  if (CombinedGraphQLErrors.is(error)) {
    return 'The live server answered, but it does not serve this version of the Resource API yet.';
  }
  const detail = error instanceof Error && error.message !== '' ? ` (${error.message})` : '';
  return `The live server could not be reached${detail}.`;
};

/** Without it one transient failure pins the banner for good while every query behind it succeeds. */
export const clearOnSuccessLink = (): ApolloLink =>
  new ApolloLink(
    (operation, forward) =>
      new Observable<ApolloLink.Result>((observer) =>
        forward(operation).subscribe({
          next: (result) => {
            if (result.errors === undefined || result.errors.length === 0) {
              clearLiveFailure();
            }
            observer.next(result);
          },
          error: (error: unknown) => {
            observer.error(error);
          },
          complete: () => {
            observer.complete();
          },
        }),
      ),
  );

/**
 * The signed-in user's token, on every request. v1 requires no authentication, so this is
 * forward-looking: when the service starts reading the header, no frontend change is
 * needed. Signed out, the header is omitted rather than sent empty, and nothing is
 * reported - an anonymous request is a normal request here.
 */
export const authLink = (): ApolloLink =>
  // Read per request from the shared store, so a sign-in takes effect without a reload.
  new SetContextLink((prevContext) => {
    const token = store.get(odbTokenAtom);
    // Apollo types operation context values as `any`; pin the headers shape.
    const prevHeaders = (prevContext.headers ?? {}) as Record<string, string>;
    return {
      headers: token ? { ...prevHeaders, Authorization: `Bearer ${token}` } : prevHeaders,
    };
  });

const liveLink = (): ApolloLink =>
  ApolloLink.from([
    authLink(),
    clearOnSuccessLink(),
    new ErrorLink(({ error }) => {
      reportLiveFailure(liveFailureMessage(error));
    }),
    new HttpLink({ uri: withAbsoluteUri(liveGraphqlEndpoint) }),
  ]);

export const client = new ApolloClient({
  clientAwareness: {
    name: 'resource-ui',
    version: import.meta.env.FRONTEND_VERSION,
  },
  link: liveLink(),
  cache: buildCache(),
});
