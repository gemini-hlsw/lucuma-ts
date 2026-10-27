import type { ExecutionResult } from 'graphql';

import type { InstrumentConfig, MutationupdateInstrumentArgs } from '../graphql/gen/types.generated.ts';
import { test } from './setup.ts';

/**
 * Pins the wire format of the scalars that come from `graphql-scalars`
 * (PosInt via PositiveIntResolver, plus DateTime, JSON and Void in the generated resolver map),
 * so a change in that library's parse or serialize behavior fails here.
 */
describe('graphql-scalars wire format', () => {
  describe('PosInt', () => {
    test('accepts a variable and an inline literal, and serializes as a number', async ({ executeGraphql }) => {
      const fromVariable = await executeGraphql<MutationupdateInstrumentArgs, { updateInstrument: InstrumentConfig }>({
        query: `#graphql
          mutation updateInstrument($pk: PosInt!) {
            updateInstrument(pk: $pk, comment: "from variable") {
              pk
            }
          }`,
        variables: { pk: 1 },
      });
      expect(fromVariable.data?.updateInstrument).toStrictEqual({ pk: 1 });

      const fromLiteral = await executeGraphql<Record<string, never>, { updateInstrument: InstrumentConfig }>({
        query: `#graphql
          mutation {
            updateInstrument(pk: 1, comment: "from literal") {
              pk
            }
          }`,
        variables: {},
      });
      expect(fromLiteral.data?.updateInstrument).toStrictEqual({ pk: 1 });
    });

    test('coerces a numeric string variable to a number', async ({ executeGraphql }) => {
      const response = await executeGraphql<{ pk: string }, { updateInstrument: InstrumentConfig }>({
        query: `#graphql
          mutation updateInstrument($pk: PosInt!) {
            updateInstrument(pk: $pk) {
              pk
            }
          }`,
        variables: { pk: '1' },
      });
      expect(response.data?.updateInstrument).toStrictEqual({ pk: 1 });
    });

    test.for([
      { label: 'zero variable', query: 'mutation($pk: PosInt!) { deleteInstrument(pk: $pk) }', pk: 0 },
      { label: 'negative variable', query: 'mutation($pk: PosInt!) { deleteInstrument(pk: $pk) }', pk: -1 },
      { label: 'non-numeric variable', query: 'mutation($pk: PosInt!) { deleteInstrument(pk: $pk) }', pk: 'one' },
      { label: 'zero literal', query: 'mutation { deleteInstrument(pk: 0) }', pk: undefined },
      { label: 'string literal', query: 'mutation { deleteInstrument(pk: "1") }', pk: undefined },
    ])('rejects a $label', async ({ query, pk }, { yoga, prisma }) => {
      const res = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query, variables: { pk } }),
      });
      const body = (await res.json()) as ExecutionResult;

      expect(body.data).toBeUndefined();
      expect(body.errors).toHaveLength(1);
      expect(await prisma.instrument.findUnique({ where: { pk: 1 } })).not.toBeNull();
    });
  });

  describe('DateTime', () => {
    test('serializes a database timestamp as an ISO 8601 UTC string with milliseconds', async ({
      executeGraphql,
      prisma,
    }) => {
      const createdAt = new Date('2024-03-04T05:06:07.089Z');
      const { pk } = await prisma.instrument.update({ where: { pk: 1 }, data: { createdAt }, select: { pk: true } });

      const response = await executeGraphql<MutationupdateInstrumentArgs, { updateInstrument: InstrumentConfig }>({
        query: `#graphql
          mutation updateInstrument($pk: PosInt!) {
            updateInstrument(pk: $pk) {
              createdAt
            }
          }`,
        variables: { pk },
      });

      expect(response.data?.updateInstrument).toStrictEqual({ createdAt: '2024-03-04T05:06:07.089Z' });
    });
  });

  describe('JSON', () => {
    const extraParams = { str: 'a', int: 1, float: 2.5, bool: false, nil: null, list: [1, 'two', { three: 3 }] };

    test('round-trips nested values given as a variable', async ({ executeGraphql, prisma }) => {
      const response = await executeGraphql<MutationupdateInstrumentArgs, { updateInstrument: InstrumentConfig }>({
        query: `#graphql
          mutation updateInstrument($pk: PosInt!, $extraParams: JSON!) {
            updateInstrument(pk: $pk, extraParams: $extraParams) {
              extraParams
            }
          }`,
        variables: { pk: 1, extraParams },
      });

      expect(response.data?.updateInstrument).toStrictEqual({ extraParams });
      expect((await prisma.instrument.findUniqueOrThrow({ where: { pk: 1 } })).extraParams).toStrictEqual(extraParams);
    });

    test('parses nested values given as an inline literal', async ({ executeGraphql }) => {
      const response = await executeGraphql<Record<string, never>, { updateInstrument: InstrumentConfig }>({
        query: `#graphql
          mutation {
            updateInstrument(
              pk: 1
              extraParams: { str: "a", int: 1, float: 2.5, bool: false, nil: null, list: [1, "two", { three: 3 }] }
            ) {
              extraParams
            }
          }`,
        variables: {},
      });

      expect(response.data?.updateInstrument).toStrictEqual({ extraParams });
    });
  });

  describe('Void', () => {
    test('serializes as null', async ({ executeGraphql, prisma }) => {
      const { pk } = await prisma.instrument.create({
        data: {
          name: 'GMOS_SOUTH',
          issPort: 9,
          wfs: 'OIWFS',
          isTemporary: false,
          extraParams: {},
          ao: false,
          originX: 0,
          originY: 0,
          focusOffset: 0,
          iaa: 0,
        },
        select: { pk: true },
      });

      const response = await executeGraphql<{ pk: number }, { deleteInstrument: null }>({
        query: `#graphql
          mutation deleteInstrument($pk: PosInt!) {
            deleteInstrument(pk: $pk)
          }`,
        variables: { pk },
      });

      expect(response.data).toStrictEqual({ deleteInstrument: null });
      expect(await prisma.instrument.findUnique({ where: { pk } })).toBeNull();
    });
  });
});
