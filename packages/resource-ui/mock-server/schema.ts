/**
 * Builds an executable mock schema over a fresh store from an SDL string.
 *
 * Shared by the dev server (mock-server/server.ts) and the browser-test Apollo
 * client (src/test/mockClient.ts), so both exercise the same resolvers. The SDL is
 * supplied by the caller (Node reads the file; the browser imports it with `?raw`)
 * to keep this module free of environment-specific I/O.
 */
import { createSchema } from 'graphql-yoga';

import { buildResolvers } from './resolvers.ts';
import { MockStore } from './store.ts';

export interface MockSchema {
  schema: ReturnType<typeof createSchema>;
  store: MockStore;
}

/** Creates an executable schema backed by a fresh in-memory store. */
export const buildMockSchema = (typeDefs: string): MockSchema => {
  const store = new MockStore();
  const schema = createSchema({
    typeDefs,
    resolvers: buildResolvers(store),
  });
  return { schema, store };
};
