import type { Logger, YogaInitialContext } from 'graphql-yoga';
import { createSchema, createYoga, useReadinessCheck } from 'graphql-yoga';

import { resolvers } from './graphql/gen/resolvers.generated.ts';
import { typeDefs } from './graphql/gen/typeDefs.generated.ts';
import type { PrismaClient } from './prisma/db.ts';

export interface GraphQLContext extends YogaInitialContext {
  prisma: PrismaClient;
}

const schema = createSchema({ typeDefs, resolvers });

export function makeYogaServer({ prisma, log }: { prisma: PrismaClient; log: Logger }) {
  return createYoga<GraphQLContext>({
    id: 'navigate-configs',
    schema,
    graphqlEndpoint: '/*',
    context: { prisma },
    logging: log,
    maskedErrors: false,
    batching: true,
    healthCheckEndpoint: '/health',
    plugins: [
      useReadinessCheck({
        endpoint: '/ready',
        check: async () => {
          log.debug('Performing readiness check');
          await prisma.$queryRaw`SELECT 1`;
        },
      }),
    ],
  });
}
