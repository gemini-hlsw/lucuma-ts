import { resolveSelectFields } from '../query-fields.ts';
import type { InstrumentConfig, MutationResolvers } from './../../gen/types.generated.ts';

export const updateInstrument: NonNullable<MutationResolvers['updateInstrument']> = (
  _parent,
  args,
  { prisma },
  info,
) => {
  return prisma.instrument.update({
    where: { pk: args.pk },
    data: args,
    ...resolveSelectFields<'Instrument'>(info),
  }) as Promise<InstrumentConfig>;
};
