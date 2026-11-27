import { resolveSelectFields } from '../query-fields.ts';
import type { InstrumentConfig, MutationResolvers } from './../../gen/types.generated.ts';

export const createInstrument: NonNullable<MutationResolvers['createInstrument']> = (
  _parent,
  args,
  { prisma },
  info,
) => {
  return prisma.instrument.create({
    data: { extraParams: {}, ...args },
    select: resolveSelectFields(info),
  }) as Promise<InstrumentConfig>;
};
