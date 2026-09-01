/** Through graphql(), which validates unlike SchemaLink, so a documented example cannot drift. */
import { graphql } from 'graphql';
import { describe, expect, it } from 'vitest';

import doc from '../../ENDPOINTS.md?raw';
import { buildMockSchema } from '../../mock-server/schema';
import sdl from '../gql/gen/schema.graphql?raw';

const examples = [...doc.matchAll(/```graphql\n([\s\S]*?)```/g)].map((match) => match[1] ?? '');

describe('the ENDPOINTS.md examples', () => {
  it('finds the documented queries - a broken fence would silently pin nothing', () => {
    expect(examples.length).toBeGreaterThanOrEqual(8);
  });

  it('executes every documented query against the schema the mock serves', async () => {
    const { schema } = buildMockSchema(sdl);
    for (const source of examples) {
      const result = await graphql({ schema, source });
      expect.soft(result.errors, source).toBeUndefined();
      expect.soft(result.data, source).toBeTruthy();
    }
  });
});
