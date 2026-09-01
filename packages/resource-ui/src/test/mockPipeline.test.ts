/** The load-bearing property of the mock harness: a browser test and :4000 run identical code. */
import { parse, validate } from 'graphql';
import { describe, expect, it } from 'vitest';

import { PUBLISHED_SEMESTERS_QUERY } from '@/gql/resource';

import { createMockApollo } from './mockClient';

describe('mock pipeline', () => {
  it('executes a typed document against the mock resolvers', async () => {
    const { client } = createMockApollo();

    const result = await client.query({ query: PUBLISHED_SEMESTERS_QUERY });

    // The nine semesters the workbook holds: GS 2024B-2026A, GN 2024B-2026B.
    expect(result.data?.publishedSemesters).toHaveLength(9);
    expect(result.data?.publishedSemesters.map((entry) => `${entry.site} ${entry.semester}`)).toContain('GS 2025B');
  });

  it('gives each caller an independent store', () => {
    const first = createMockApollo();
    const second = createMockApollo();

    expect(first.store).not.toBe(second.store);
  });

  it('validates operations against the schema, which SchemaLink alone does not', () => {
    const { schema } = createMockApollo();

    // SchemaLink executes without validating, so validate explicitly.
    expect(validate(schema, parse('{ publishedSemesters { site semester } }'))).toEqual([]);
    expect(validate(schema, parse('{ noSuchField }'))).not.toEqual([]);
  });
});
