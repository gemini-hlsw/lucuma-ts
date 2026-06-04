import { resolveSelectFields } from '../query-fields.ts';
import type { QueryResolvers } from './../../gen/types.generated.ts';

export const gemsInstrument: NonNullable<QueryResolvers['gemsInstrument']> = (_parent, args, { prisma }, info) => {
  return prisma.gemsInstrument.findFirst({ where: args, ...resolveSelectFields<'GemsInstrument'>(info) });
};
