import { ApolloClient, ApolloLink } from '@apollo/client';
import { SchemaLink } from '@apollo/client/link/schema';

import { buildMockSchema, type MockSchema } from '../../mock-server/schema';
import { buildCache } from '../gql/cache';
// Codegen's expansion, which the :4000 server reads too, so the two cannot disagree.
import schemaSource from '../gql/gen/schema.graphql?raw';

export interface MockApollo {
  client: ApolloClient;
  store: MockSchema['store'];
  /** Exposed so tests can validate documents: SchemaLink executes without validating. */
  schema: MockSchema['schema'];
}

/** `before` covers what the resolvers cannot: a transport failure, and the variables sent. */
export const createMockApollo = (before?: ApolloLink): MockApollo => {
  const { schema, store } = buildMockSchema(schemaSource);
  const schemaLink = new SchemaLink({ schema });
  const client = new ApolloClient({
    link: before === undefined ? schemaLink : ApolloLink.from([before, schemaLink]),
    cache: buildCache(),
  });
  return { client, store, schema };
};
