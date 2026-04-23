import assert from 'node:assert';
import fs from 'node:fs/promises';
import { after, afterEach, before, beforeEach } from 'node:test';

import { PrismaPg } from '@prisma/adapter-pg';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { ExecutionResult } from 'graphql';
import type { YogaServerInstance } from 'graphql-yoga';

import type { PrismaClient as Prisma } from '../prisma/db.ts';
import { extendPrisma } from '../prisma/extend.ts';
import { PrismaClient } from '../prisma/gen/client.ts';
import { populateDb } from '../prisma/queries/main.ts';
import { type GraphQLContext, makeYogaServer } from '../server.ts';

interface ServerFixture {
  /**
   * Execute a graphql operation and return the result.
   */
  executeGraphql: <
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
    TVariables extends Record<string, unknown>,
    TData extends Record<string, unknown> = Record<string, unknown>,
  >(options: {
    query: string;
    variables: TVariables;
  }) => Promise<ExecutionResult<TData>>;
  prisma: Prisma;
  yoga: YogaServerInstance<GraphQLContext, object>;
}

/**
 * Initialize a fixture for the tests. This will create a postgres container, migrate and seed the database, and setup the prisma client.
 * Also provides a helper function to execute a single graphql operation.
 *
 * Fixture is created in a before hook and torn down in an after hook.
 */
export function initializeServerFixture() {
  // Mutable fixture object that holds the database connection and other useful objects
  const fixture: ServerFixture = {} as ServerFixture;

  let container: StartedPostgreSqlContainer;

  let isFirstRun = true;

  // Register setup to create the fixture
  before(async () => {
    // Create a postgres container for the tests
    container = await new PostgreSqlContainer('postgres:alpine').start();

    // Migrate and seed the database
    const client = extendPrisma(
      new PrismaClient({ adapter: new PrismaPg({ connectionString: container.getConnectionUri() }) }),
    );
    await migrateAndPopulateDb(client);
    await client.$disconnect();

    // Save starting snapshot of the database
    await container.snapshot();
  });

  beforeEach(async () => {
    if (!isFirstRun) {
      // Restore the database to a clean state before each test (except the first)
      await container.restoreSnapshot();
    } else {
      isFirstRun = false;
    }

    // Setup Prisma client with the test container connection
    const prisma = extendPrisma(
      new PrismaClient({ adapter: new PrismaPg({ connectionString: container.getConnectionUri() }) }),
    );

    const yoga = makeYogaServer({ prisma, disposeOnProcessTerminate: false });
    fixture.yoga = yoga;

    const executeGraphql: ServerFixture['executeGraphql'] = async <TData extends Record<string, unknown>>({
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
      });

      assert.ok(res.ok, `Graphql request failed: ${res.status} ${res.statusText} - ${await res.text()}`);

      const body = (await res.json()) as ExecutionResult<TData>;

      assert.ifError(body.errors);

      return body;
    };

    fixture.executeGraphql = executeGraphql;
    fixture.prisma = prisma;
  });

  afterEach(async () => {
    await fixture.yoga.dispose();
    await fixture.prisma?.$disconnect();
  });

  // Register teardown
  after(async () => {
    await container.stop({ timeout: 10_000 });
  });

  return fixture;
}

/**
 * Apply all migrations, quicker than using prisma migrate deploy
 */
async function migrateAndPopulateDb(client: Prisma) {
  const migrationDirs = (await fs.readdir('./prisma/migrations')).sort().filter((f) => !f.includes('.'));
  for (const dir of migrationDirs) {
    const migrationSqlContent = await fs.readFile(`./prisma/migrations/${dir}/migration.sql`, 'utf-8');
    await client.$executeRawUnsafe(migrationSqlContent);
  }
  await populateDb(client, () => {
    /* don't log db initialization */
  });
}
