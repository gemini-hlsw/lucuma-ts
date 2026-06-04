import { resolveSelectFields } from '../query-fields.ts';
import type { QueryResolvers } from './../../gen/types.generated.ts';

export const rotator: NonNullable<QueryResolvers['rotator']> = (_parent, args, { prisma }, info) => {
  return prisma.rotator.findFirst({ where: args, ...resolveSelectFields<'Rotator'>(info) });
};
