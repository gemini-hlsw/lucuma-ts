import { resolveSelectFields } from '../query-fields.ts';
import type { QueryResolvers } from './../../gen/types.generated.ts';

export const mechanism: NonNullable<QueryResolvers['mechanism']> = (_parent, args, { prisma }, info) => {
  return prisma.mechanism.findFirst({ where: args, ...resolveSelectFields<'Mechanism'>(info) });
};
