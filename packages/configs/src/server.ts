import { createSchema, createYoga, type YogaInitialContext } from 'graphql-yoga';

import { resolvers } from './graphql/gen/resolvers.generated.ts';
import { typeDefs } from './graphql/gen/typeDefs.generated.ts';
import type { PrismaClient } from './prisma/db.ts';

export interface GraphQLContext extends YogaInitialContext {
  prisma: PrismaClient;
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
    context: { prisma },
    maskedErrors: false,
    disposeOnProcessTerminate: disposeOnProcessTerminate ?? true,
  });
}
