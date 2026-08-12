/**
 * Local mock GraphQL server for developing the Resource UI.
 *
 * Serves the v1 schema preview backed by the in-memory store. Mutations persist for
 * the life of the process (no database). Run with `pnpm dev:mock-server`.
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

import { createSchema, createYoga } from 'graphql-yoga';

import { buildResolvers } from './resolvers.ts';
import { MockStore } from './store.ts';

const PORT = 4000;
const GRAPHQL_ENDPOINT = '/graphql';

const typeDefs = readFileSync(fileURLToPath(new URL('./schema.graphql', import.meta.url)), 'utf8');

const store = new MockStore();
const schema = createSchema({ typeDefs, resolvers: buildResolvers(store) });

const yoga = createYoga({ schema, graphqlEndpoint: GRAPHQL_ENDPOINT });

// eslint-disable-next-line @typescript-eslint/no-misused-promises
const server = createServer(yoga);

server.listen(PORT, () => {
  console.info('Resource mock GraphQL server started');
  console.info(`GraphQL endpoint: http://localhost:${PORT}${GRAPHQL_ENDPOINT}`);
});
