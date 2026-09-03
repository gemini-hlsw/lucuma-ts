import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import type { ExecutionResult } from 'graphql';
import { createLogger } from 'graphql-yoga';
import { expect, inject, test as baseTest } from 'vitest';

import type { PrismaClient as Prisma } from '../prisma/db.ts';
import { extendPrisma } from '../prisma/extend.ts';
import { PrismaClient } from '../prisma/gen/client.ts';
import { makeYogaServer } from '../server.ts';

const noopLogger = createLogger('silent');

/**
 * Execute a graphql operation and return the result.
 */
type ExecuteGraphql = <
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  TVariables extends Record<string, unknown>,
  TData extends Record<string, unknown> = Record<string, unknown>,
>(options: {
  query: string;
  variables: TVariables;
}) => Promise<ExecutionResult<TData>>;

/**
 * Test API with server fixtures
 *
 * ```ts
 * test('updates a target', async ({ executeGraphql, prisma }) => { ... });
 * ```
 */
export const test = baseTest
  // Connection to the `postgres` maintenance database. It creates and drops the database of
  // each test. It must never connect to the template database.
  // eslint-disable-next-line no-empty-pattern -- Vitest requires a destructuring pattern here.
  .extend('maintenance', { scope: 'file' }, ({}, { onCleanup }) => {
    const client = new PrismaClient({
      adapter: new PrismaPg({ connectionString: `${inject('postgresBaseUri')}/postgres` }),
    });
    onCleanup(() => client.$disconnect());

    return client;
  })
  // Prisma client for the current test, on a private copy of the seeded template database.
  .extend('prisma', async ({ maintenance }, { onCleanup }): Promise<Prisma> => {
    const database = `test_${randomUUID().replace(/-/g, '')}`;
    await forkTemplateDatabase(maintenance, database);

    const prisma = extendPrisma(
      new PrismaClient({
        adapter: new PrismaPg({ connectionString: `${inject('postgresBaseUri')}/${database}` }),
      }),
    );
    onCleanup(async () => {
      await prisma.$disconnect();
      await maintenance.$executeRawUnsafe(`DROP DATABASE "${database}" WITH (FORCE)`);
    });

    return prisma;
  })
  .extend('yoga', ({ prisma }, { onCleanup }) => {
    const yoga = makeYogaServer({ prisma, log: noopLogger });
    onCleanup(() => yoga.dispose());

    return yoga;
  })
  .extend('executeGraphql', ({ yoga, signal }): ExecuteGraphql => {
    return async <TData extends Record<string, unknown>>({
      query,
      variables,
    }: {
      query: string;
      variables: Record<string, unknown>;
    }) => {
      const res = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query: query,
          variables: variables ?? undefined,
        }),
        signal,
      });

      if (!res.ok) expect.fail(`Graphql request failed: ${res.status} ${res.statusText} - ${await res.text()}`);

      const body = (await res.json()) as ExecutionResult<TData>;

      expect(body.errors).toBeUndefined();

      return body;
    };
  });

/**
 * Copy the seeded template database into a database of its own.
 */
async function forkTemplateDatabase(maintenance: PrismaClient, database: string) {
  const template = inject('templateDatabase');

  await maintenance.$executeRawUnsafe(`CREATE DATABASE "${database}" TEMPLATE "${template}"`);
  return;
}
