import { resolveSelectFields } from '../query-fields.ts';
import type { InstrumentConfig, MutationResolvers } from './../../gen/types.generated.ts';

export const setTemporaryInstrument: NonNullable<MutationResolvers['setTemporaryInstrument']> = async (
  _parent,
  args,
  { prisma },
  info,
) => {
  const tempInstrument = await prisma.instrument.findFirst({
    where: { name: args.name, issPort: args.issPort, wfs: args.wfs, isTemporary: true },
    select: { pk: true },
    orderBy: [{ isTemporary: 'desc' }, { createdAt: 'desc' }],
  });
  if (tempInstrument) {
    return prisma.instrument.update({
      where: { pk: tempInstrument.pk },
      data: args,
      ...resolveSelectFields<'Instrument'>(info),
    }) as Promise<InstrumentConfig>;
  } else {
    return prisma.instrument.create({
      data: { extraParams: {}, ...args, isTemporary: true },
      ...resolveSelectFields<'Instrument'>(info),
    }) as Promise<InstrumentConfig>;
  }
};
