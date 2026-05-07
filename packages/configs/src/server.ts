import type { YogaInitialContext, YogaLogger } from 'graphql-yoga';
import { createSchema, createYoga, useReadinessCheck } from 'graphql-yoga';

import { resolvers } from './graphql/gen/resolvers.generated.ts';
import { typeDefs } from './graphql/gen/typeDefs.generated.ts';
import { log } from './logger.ts';
import type { PrismaClient } from './prisma/db.ts';

export interface GraphQLContext extends YogaInitialContext {
  prisma: PrismaClient;
  log: YogaLogger;
}

const schema = createSchema({ typeDefs, resolvers });

export function makeYogaServer({
  prisma,
  disposeOnProcessTerminate,
}: {
  prisma: PrismaClient;
  disposeOnProcessTerminate?: boolean;
}) {
  return createYoga<GraphQLContext>({
    schema,
    graphqlEndpoint: '/*',
    context: { prisma, log },
    logging: log,
    maskedErrors: false,
    disposeOnProcessTerminate: disposeOnProcessTerminate ?? true,
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
