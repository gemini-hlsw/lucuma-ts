import { createSchema } from 'graphql-yoga';

import { buildResolvers } from './resolvers.ts';
import { MockStore } from './store.ts';

export interface MockSchema {
  schema: ReturnType<typeof createSchema>;
  store: MockStore;
}

export const buildMockSchema = (typeDefs: string): MockSchema => {
  const store = new MockStore();
  const schema = createSchema({
    typeDefs,
    resolvers: buildResolvers(store),
  });
  return { schema, store };
};
