/**
 * Apollo Client for the Resource UI.
 *
 * One backend: HTTP to the Resource service, which in development the vite
 * proxy carries to the dev deployment purely to sidestep CORS. The service does
 * not serve the v1 API yet, so the link watches for failure and reports it in
 * plain words (`liveStatus.ts`), where the banner says so.
 *
 * There was a second source until 2026-08-14 (Hugo's review): the mock schema
 * executed in the browser over Apollo `SchemaLink`, chosen from a masthead
 * control. It put graphql-yoga, an executable schema and the SDL - 245 kB of
 * server-side code - into the frontend bundle, and it is gone. The mock is
 * still the browser tests' backend and still runs as a GraphQL server on :4000
 * (`pnpm dev:mock-server`).
 *
 * `RESOURCE_API=mock` points the dev server's proxy at it, so a developer can
 * see the views with data. That is a vite setting and nothing here changes for
 * it: this file builds one link to one path either way, and only which process
 * answers on localhost differs. No control, no second link, no schema in the
 * bundle - which is the distinction the 2026-08-14 decision was drawing.
 *
 * When the Scala backend ships, the endpoint mapping below is the only thing
 * that changes.
 */
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

/**
 * A live failure, said in words a tester can act on.
 *
 * GraphQL errors mean the server answered but not this API - the expected
 * state until the v1 backend ships. Anything else is the server not
 * answering at all. Exported pure so the phrasing is testable.
 */
export const liveFailureMessage = (error: unknown): string => {
  if (CombinedGraphQLErrors.is(error)) {
    return 'The live server answered, but it does not serve this version of the Resource API yet.';
  }
  const detail = error instanceof Error && error.message !== '' ? ` (${error.message})` : '';
  return `The live server could not be reached${detail}.`;
};

/**
 * Clears the failure banner on an answer that carries no error.
 *
 * The counterpart to `ErrorLink` below, and the reason the banner states the
 * situation rather than the worst moment of the session: without it one
 * transient failure - a restarting deployment, a dropped connection - pins the
 * banner for good, while every query behind it succeeds. A result *with*
 * errors is left alone; `ErrorLink` passes those through untouched and is the
 * one that speaks for them.
 *
 * Exported so a test can compose it over a stub link, the way `liveLink` does
 * over HTTP.
 */
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
