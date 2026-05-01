/**
 * Creates a local mock GraphQL server for developing the Resource UI.
 */

import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

import { createSchema, createYoga } from 'graphql-yoga';

import { mockTelescopeNightTimelines } from './data/mockTelescopeNightTimelines.ts';

const PORT = 4000;
const GRAPHQL_ENDPOINT = '/graphql';
const SCHEMA_PATH = 'mock-server/schema.graphql';

interface TelescopeNightTimelineProps {
  site: string;
  observingDate: string;
}

/**
 * Returns mock telescope night timeline data.
 *
 * @param _parent - Unused GraphQL parent resolver value.
 * @param props - Query properties from the GraphQL request.
 * @returns Matching mock telescope night timeline, or null if none exists.
 */
function getMockTelescopeNightTimeline(_parent: unknown, props: TelescopeNightTimelineProps) {
  console.info(`Looking up telescopeNightTimeline for site=${props.site}, observingDate=${props.observingDate}`);

  const timeline = mockTelescopeNightTimelines.find(
    (entry) => entry.site === props.site && entry.observingDate === props.observingDate,
  );

  if (!timeline) {
    console.warn(`No mock telescope night timeline found for site=${props.site}, observingDate=${props.observingDate}`);

    return null;
  }

  return timeline;
}

console.info(`Loading mock GraphQL schema from ${SCHEMA_PATH}`);

const typeDefs = readFileSync(SCHEMA_PATH, 'utf8');

const schema = createSchema({
  typeDefs,
  resolvers: {
    Query: {
      // Define queries here, matching the schema's Query type.
      telescopeNightTimeline: getMockTelescopeNightTimeline,
    },
  },
});

const yoga = createYoga({
  schema,
  graphqlEndpoint: GRAPHQL_ENDPOINT,
});

const server = createServer(yoga);

server.listen(PORT, () => {
  console.info('Resource mock GraphQL server started');
  console.info(`GraphQL endpoint: http://localhost:${PORT}${GRAPHQL_ENDPOINT}`);
});
