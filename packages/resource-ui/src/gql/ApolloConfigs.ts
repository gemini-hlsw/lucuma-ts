import { ApolloClient, ApolloLink, HttpLink } from '@apollo/client';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { ErrorLink } from '@apollo/client/link/error';
import { Observable } from '@apollo/client/utilities';
import { withAbsoluteUri } from '@gemini-hlsw/lucuma-common-ui';

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

const liveLink = (): ApolloLink =>
  ApolloLink.from([
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
