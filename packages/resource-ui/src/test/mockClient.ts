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
import { buildCache } from '../gql/cache';
// Codegen's expansion of mock-server/schema.graphql, which is also what the :4000
// server reads - so a browser test and a GraphiQL click-through cannot disagree.
import schemaSource from '../gql/gen/schema.graphql?raw';

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
