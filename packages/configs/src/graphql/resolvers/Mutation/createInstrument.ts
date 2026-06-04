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
    ...resolveSelectFields<'Instrument'>(info),
  }) as Promise<InstrumentConfig>;
};
