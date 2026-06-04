import { resolveSelectFields } from '../query-fields.ts';
import type { QueryResolvers } from './../../gen/types.generated.ts';

export const altairGuideLoop: NonNullable<QueryResolvers['altairGuideLoop']> = (_parent, args, { prisma }, info) => {
  return prisma.altairGuideLoop.findFirst({ where: args, ...resolveSelectFields<'AltairGuideLoop'>(info) });
};
