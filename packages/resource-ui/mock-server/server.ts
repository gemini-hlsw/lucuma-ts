/**
 * Local mock GraphQL server for developing the Resource UI.
 *
 * Serves the v1 schema preview backed by the in-memory store. Mutations persist for
 * the life of the process (no database). Run with `pnpm dev:mock-server`.
 */
import { createServer } from 'node:http';

import { createYoga } from 'graphql-yoga';

import { buildMockSchema } from './schema.ts';
import { mockSdl } from './sdl.ts';

const PORT = 4000;
const GRAPHQL_ENDPOINT = '/graphql';

const { schema } = buildMockSchema(mockSdl());

const yoga = createYoga({ schema, graphqlEndpoint: GRAPHQL_ENDPOINT });

// eslint-disable-next-line @typescript-eslint/no-misused-promises
const server = createServer(yoga);

server.listen(PORT, () => {
  console.info('Resource mock GraphQL server started');
  console.info(`GraphQL endpoint: http://localhost:${PORT}${GRAPHQL_ENDPOINT}`);
});
