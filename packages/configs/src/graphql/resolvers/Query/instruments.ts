import { resolveSelectFields } from '../query-fields.ts';
import type { InstrumentConfig, QueryResolvers } from './../../gen/types.generated.ts';
import { createExtraParamsFilter } from './instrument.ts';

export const instruments: NonNullable<QueryResolvers['instruments']> = (_parent, args, { prisma }, info) => {
  return prisma.instrument.findMany({
    where: { ...args, extraParams: createExtraParamsFilter(args.extraParams) },
    select: resolveSelectFields(info),
    orderBy: [{ isTemporary: 'desc' }, { createdAt: 'desc' }],
  }) as Promise<InstrumentConfig[]>;
};
