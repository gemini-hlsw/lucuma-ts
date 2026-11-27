import { buildSchema, execute, type GraphQLResolveInfo, parse } from 'graphql';
import { describe, expect, test } from 'vitest';

import { resolveSelectFields } from './query-fields.ts';

const schema = buildSchema(/* GraphQL */ `
  type Query {
    target: Target
    targetCount: Int!
  }

  type Target {
    pk: Int!
    name: String!
    sidereal: Sidereal
    instrument: Instrument
  }

  type Sidereal {
    ra: Float
    dec: Float
  }

  type Instrument {
    name: String
    rotator: Rotator
  }

  type Rotator {
    angle: Float
  }
`);

/**
 * Execute `query` and return the select computed by each root field resolver, keyed by field name.
 */
async function selectionsFor(query: string, variableValues?: Record<string, unknown>) {
  const selections: Record<string, unknown> = {};
  const record = (info: GraphQLResolveInfo) => {
    selections[info.fieldName] = { select: resolveSelectFields(info) };
  };
  // The default field resolver calls root value functions with (args, context, info).
  const rootValue = {
    target: (_args: unknown, _ctx: unknown, info: GraphQLResolveInfo) => {
      record(info);
      return null;
    },
    targetCount: (_args: unknown, _ctx: unknown, info: GraphQLResolveInfo) => {
      record(info);
      return 0;
    },
  };

  const result = await execute({ schema, document: parse(query), rootValue, variableValues });

  expect(result.errors).toBeUndefined();
  return selections;
}

/**
 * Execute `query` with one root field and return the select computed by its resolver.
 */
async function selectionFor(query: string, variableValues?: Record<string, unknown>) {
  const selections = Object.values(await selectionsFor(query, variableValues));

  expect(selections).toHaveLength(1);
  return selections[0];
}

describe(resolveSelectFields, () => {
  test('selects nested object fields recursively', async () => {
    const selection = await selectionFor(`{ target { pk sidereal { ra } instrument { name rotator { angle } } } }`);

    expect(selection).toEqual({
      select: {
        pk: true,
        sidereal: { select: { ra: true } },
        instrument: { select: { name: true, rotator: { select: { angle: true } } } },
      },
    });
  });

  test('returns an undefined select for a field without a selection set', async () => {
    const selection = await selectionFor(`{ targetCount }`);

    expect(selection).toEqual({ select: undefined });
  });

  test('ignores __typename', async () => {
    const selection = await selectionFor(`{ target { __typename pk sidereal { __typename ra } } }`);

    expect(selection).toEqual({ select: { pk: true, sidereal: { select: { ra: true } } } });
  });

  test('selects all scalars of a relation when only __typename is requested on it', async () => {
    const selection = await selectionFor(`{ target { pk sidereal { __typename } } }`);

    expect(selection).toEqual({ select: { pk: true, sidereal: true } });
  });

  test('uses the field name, not the alias, as the select key', async () => {
    const selection = await selectionFor(`{ target { id: pk coords: sidereal { rightAscension: ra } } }`);

    expect(selection).toEqual({ select: { pk: true, sidereal: { select: { ra: true } } } });
  });

  test('merges the sub-selections of a field that is selected more than once', async () => {
    const selection = await selectionFor(`{ target { sidereal { ra } other: sidereal { dec } } }`);

    expect(selection).toEqual({ select: { sidereal: { select: { ra: true, dec: true } } } });
  });

  test('merges the selections of a root field that is selected more than once', async () => {
    const selection = await selectionFor(`{ target { pk } target { name } }`);

    expect(selection).toEqual({ select: { pk: true, name: true } });
  });

  test('expands named fragments', async () => {
    const selection = await selectionFor(`
      query {
        target { ...TargetFields sidereal { ...SiderealFields } }
      }
      fragment TargetFields on Target { pk name }
      fragment SiderealFields on Sidereal { dec }
    `);

    expect(selection).toEqual({ select: { pk: true, name: true, sidereal: { select: { dec: true } } } });
  });

  test('expands nested named fragments', async () => {
    const selection = await selectionFor(`
      query {
        target { ...Outer }
      }
      fragment Outer on Target { pk ...Inner }
      fragment Inner on Target { name }
    `);

    expect(selection).toEqual({ select: { pk: true, name: true } });
  });

  test('expands inline fragments with and without a type condition', async () => {
    const selection = await selectionFor(`{ target { ... on Target { pk } ... { name } } }`);

    expect(selection).toEqual({ select: { pk: true, name: true } });
  });

  test('leaves out fields with @skip(if: true) and @include(if: false)', async () => {
    const selection = await selectionFor(`{ target { pk name @skip(if: true) sidereal @include(if: false) { ra } } }`);

    expect(selection).toEqual({ select: { pk: true } });
  });

  test('keeps fields with @skip(if: false) and @include(if: true)', async () => {
    const selection = await selectionFor(`{ target { pk @skip(if: false) name @include(if: true) } }`);

    expect(selection).toEqual({ select: { pk: true, name: true } });
  });

  test('reads @skip and @include conditions from variables', async () => {
    const selection = await selectionFor(
      `query ($skipName: Boolean!, $withSidereal: Boolean!) {
        target { pk name @skip(if: $skipName) sidereal @include(if: $withSidereal) { ra } }
      }`,
      { skipName: true, withSidereal: false },
    );

    expect(selection).toEqual({ select: { pk: true } });
  });

  test('leaves out skipped fragment spreads and inline fragments', async () => {
    const selection = await selectionFor(
      `
      query ($skip: Boolean!) {
        target { pk ...Names @skip(if: $skip) ... @include(if: false) { sidereal { ra } } }
      }
      fragment Names on Target { name }
    `,
      { skip: true },
    );

    expect(selection).toEqual({ select: { pk: true } });
  });

  test('leaves out skipped fields in nested selections', async () => {
    const selection = await selectionFor(
      `query ($skipRa: Boolean!) {
        target { sidereal { ra @skip(if: $skipRa) dec } }
      }`,
      { skipRa: true },
    );

    expect(selection).toEqual({ select: { sidereal: { select: { dec: true } } } });
  });

  test('keeps a field that is skipped in one place but selected in another', async () => {
    const selection = await selectionFor(
      `{ target { name @skip(if: true) name sidereal { ra } sidereal @skip(if: true) { ra } } }`,
    );

    expect(selection).toEqual({ select: { name: true, sidereal: { select: { ra: true } } } });
  });

  test('leaves out the fields of sibling root fields', async () => {
    const selections = await selectionsFor(`{ target { pk } targetCount }`);

    expect(selections).toEqual({ target: { select: { pk: true } }, targetCount: { select: undefined } });
  });

  test('ignores a spread of an unknown fragment', async () => {
    // `execute` skips validation, so an unknown fragment reaches the resolver.
    const selection = await selectionFor(`{ target { pk ...Missing } }`);

    expect(selection).toEqual({ select: { pk: true } });
  });
});
