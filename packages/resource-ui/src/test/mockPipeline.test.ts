/**
 * Proves the mock pipeline is wired end to end: a typed document from
 * `src/gql/resource.ts` executes against the same executable schema and
 * resolvers the dev server on :4000 serves, through Apollo SchemaLink.
 *
 * This is the load-bearing property of the mock harness - a browser test and a
 * manual click-through exercise identical code. Keep this test green as the
 * schema grows; if it breaks, the two consumers have diverged.
 */
import { parse, validate } from 'graphql';
import { describe, expect, it } from 'vitest';

import { PUBLISHED_SEMESTERS_QUERY } from '@/gql/resource';

import { createMockApollo } from './mockClient';

describe('mock pipeline', () => {
  it('executes a typed document against the mock resolvers', async () => {
    const { client } = createMockApollo();

    const result = await client.query({ query: PUBLISHED_SEMESTERS_QUERY });

    // The nine semesters the operations workbook holds - GS 2024B through
    // 2026A, GN 2024B through 2026B (mock-server/data/).
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

    // SchemaLink executes without validating, so an invalid selection would
    // otherwise reach a test unnoticed. Validate explicitly.
    expect(validate(schema, parse('{ publishedSemesters { site semester } }'))).toEqual([]);
    expect(validate(schema, parse('{ noSuchField }'))).not.toEqual([]);
  });
});
