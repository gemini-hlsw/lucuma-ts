/**
 * Apollo Client for the Resource UI, wired to the selected data source.
 *
 * - **DEMO** executes against the in-browser mock: the same `buildMockSchema`
 *   over the same SDL the dev server serves and the browser tests run - one
 *   schema, three consumers, none of which can drift. A deployed build needs
 *   no backend at all.
 * - **LIVE** is HTTP to the actual Resource service - in development too,
 *   where the vite proxy carries `/resource/graphql` to the dev deployment
 *   purely to sidestep CORS. The live service does not serve the v1 API yet,
 *   so the link watches for failure and reports it in plain words
 *   (`dataSource.ts`), where the banner offers the way back to demo data.
 *   The local mock server hosts the demo data over HTTP (GraphiQL, external
 *   consumers) at :4000 directly; it never stands in for the live server.
 *
 * When the Scala backend ships, the endpoint mapping below is the only thing
 * that changes.
 */
import { ApolloClient, ApolloLink, HttpLink } from '@apollo/client';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { ErrorLink } from '@apollo/client/link/error';
import { SchemaLink } from '@apollo/client/link/schema';
import { withAbsoluteUri } from '@gemini-hlsw/lucuma-common-ui';

import { buildMockSchema } from '../../mock-server/schema';
// The SDL is the codegen source of truth; importing it raw keeps the demo in sync.
import schemaSource from '../../mock-server/schema.graphql?raw';
import { buildCache } from './cache';
import { readDataSource, reportLiveFailure } from './dataSource';

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

const liveLink = (): ApolloLink =>
  ApolloLink.from([
    new ErrorLink(({ error }) => {
      reportLiveFailure(liveFailureMessage(error));
    }),
    new HttpLink({ uri: withAbsoluteUri(liveGraphqlEndpoint) }),
  ]);

const demoLink = (): ApolloLink => new SchemaLink({ schema: buildMockSchema(schemaSource).schema });

export const client = new ApolloClient({
  clientAwareness: {
    name: 'resource-ui',
    version: import.meta.env.FRONTEND_VERSION,
  },
  link: readDataSource() === 'LIVE' ? liveLink() : demoLink(),
  cache: buildCache(),
});
