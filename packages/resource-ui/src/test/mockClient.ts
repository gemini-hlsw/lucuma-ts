/**
 * Apollo Client backed by the in-memory mock schema, for browser tests.
 *
 * Uses SchemaLink so tests exercise the real resolvers against a fresh store - the
 * same schema and resolvers the dev mock server uses. Each call returns an
 * independent client and store, so tests do not share mutable state.
 */
import { ApolloClient } from '@apollo/client';
import { SchemaLink } from '@apollo/client/link/schema';

import { buildMockSchema, type MockSchema } from '../../mock-server/schema';
// The SDL is the codegen source of truth; importing it raw keeps the mock in sync.
import schemaSource from '../../mock-server/schema.graphql?raw';
import { buildCache } from '../gql/cache';

export interface MockApollo {
  client: ApolloClient;
  store: MockSchema['store'];
  /**
   * The executable schema behind the client. Exposed so tests can validate
   * documents the way a real server does - SchemaLink executes without
   * validating, so an invalid selection would otherwise pass unnoticed.
   */
  schema: MockSchema['schema'];
}

/** Creates a fresh mock-backed Apollo client and its store. */
export const createMockApollo = (): MockApollo => {
  const { schema, store } = buildMockSchema(schemaSource);
  const client = new ApolloClient({
    link: new SchemaLink({ schema }),
    cache: buildCache(),
  });
  return { client, store, schema };
};
