import { resolveSelectFields } from '../query-fields.ts';
import type { QueryResolvers } from './../../gen/types.generated.ts';

export const altairInstrument: NonNullable<QueryResolvers['altairInstrument']> = (_parent, args, { prisma }, info) => {
  return prisma.altairInstrument.findFirst({ where: args, ...resolveSelectFields<'AltairInstrument'>(info) });
};
