import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

import { createYoga } from 'graphql-yoga';

import { buildMockSchema } from './schema.ts';

const PORT = 4000;
const GRAPHQL_ENDPOINT = '/graphql';

const { schema } = buildMockSchema(readFileSync(new URL('../src/gql/gen/schema.graphql', import.meta.url), 'utf8'));

const yoga = createYoga({ schema, graphqlEndpoint: GRAPHQL_ENDPOINT });

// eslint-disable-next-line @typescript-eslint/no-misused-promises
const server = createServer(yoga);

server.listen(PORT, () => {
  console.info('Resource mock GraphQL server started');
  console.info(`GraphQL endpoint: http://localhost:${PORT}${GRAPHQL_ENDPOINT}`);
});
