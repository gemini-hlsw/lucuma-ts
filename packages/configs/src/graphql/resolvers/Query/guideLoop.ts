import { resolveSelectFields } from '../query-fields.ts';
import type { QueryResolvers } from './../../gen/types.generated.ts';

export const guideLoop: NonNullable<QueryResolvers['guideLoop']> = (_parent, args, { prisma }, info) => {
  return prisma.guideLoop.findFirst({ where: args, ...resolveSelectFields<'GuideLoop'>(info) });
};
