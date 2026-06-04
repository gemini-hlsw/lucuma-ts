import type { InstrumentConfig, QueryResolvers } from './../../gen/types.generated.ts';
import { createExtraParamsFilter } from './instrument.ts';

export const instruments: NonNullable<QueryResolvers['instruments']> = (_parent, args, { prisma }) => {
  return prisma.instrument.findMany({
    where: { ...args, extraParams: createExtraParamsFilter(args.extraParams) },
    orderBy: [{ isTemporary: 'desc' }, { createdAt: 'desc' }],
  }) as Promise<InstrumentConfig[]>;
};
