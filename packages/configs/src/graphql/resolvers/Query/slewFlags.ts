import { resolveSelectFields } from '../query-fields.ts';
import type { QueryResolvers } from './../../gen/types.generated.ts';

export const slewFlags: NonNullable<QueryResolvers['slewFlags']> = (_parent, args, { prisma }, info) => {
  return prisma.slewFlags.findFirst({ where: args, ...resolveSelectFields<'SlewFlags'>(info) });
};
