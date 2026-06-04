import { resolveSelectFields } from '../query-fields.ts';
import type { QueryResolvers } from './../../gen/types.generated.ts';

export const gemsGuideLoop: NonNullable<QueryResolvers['gemsGuideLoop']> = (_parent, args, { prisma }, info) => {
  return prisma.gemsGuideLoop.findFirst({ where: args, ...resolveSelectFields<'GemsGuideLoop'>(info) });
};
