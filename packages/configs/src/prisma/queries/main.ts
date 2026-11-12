import type { Logger } from 'graphql-yoga';

import type { PrismaClient } from '../db.ts';
import { write } from './write.ts';

export async function populateDb(client: PrismaClient, log: Logger) {
  await write(client, log);
}
