import type { YogaLogger } from 'graphql-yoga';

import type { PrismaClient } from '../db.ts';
import { write } from './write.ts';

export async function populateDb(client: PrismaClient, log: YogaLogger) {
  await write(client, log);
}
