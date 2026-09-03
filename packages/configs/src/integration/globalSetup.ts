import fs from 'node:fs/promises';

import { PrismaPg } from '@prisma/adapter-pg';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { createLogger } from 'graphql-yoga';
import type { TestProject } from 'vitest/node';

import type { PrismaClient as Prisma } from '../prisma/db.ts';
import { extendPrisma } from '../prisma/extend.ts';
import { PrismaClient } from '../prisma/gen/client.ts';
import { populateDb } from '../prisma/queries/main.ts';

const noopLogger = createLogger('silent');

declare module 'vitest' {
  interface ProvidedContext {
    /** Connection uri of the postgres test container, without a database name. */
    postgresBaseUri: string;
    /** Name of the migrated and seeded database. Every test forks its own copy of it. */
    templateDatabase: string;
  }
}

/**
 * Start one postgres container for the whole test run, then migrate and seed it.
 *
 * The seeded database is never used by a test directly. It is the template that each test
 * copies with `CREATE DATABASE ... TEMPLATE`, so the tests can run in parallel without
 * sharing rows. See `./setup.ts`.
 */
export default async function setup(project: TestProject) {
  const container = await new PostgreSqlContainer('postgres:alpine').start();

  const templateDatabase = container.getDatabase();
  const postgresBaseUri = `postgresql://${encodeURIComponent(container.getUsername())}:${encodeURIComponent(container.getPassword())}@${container.getHost()}:${container.getPort()}`;

  // Migrate and seed the template database, then disconnect.
  const client = extendPrisma(
    new PrismaClient({ adapter: new PrismaPg({ connectionString: `${postgresBaseUri}/${templateDatabase}` }) }),
  );
  await migrateAndPopulateDb(client);
  await client.$disconnect();

  project.provide('postgresBaseUri', postgresBaseUri);
  project.provide('templateDatabase', templateDatabase);

  return async () => {
    await container.stop({ timeout: 10_000 });
  };
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
  await populateDb(client, noopLogger);
}
