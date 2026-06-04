import { resolveSelectFields } from '../query-fields.ts';
import type { MutationResolvers } from './../../gen/types.generated.ts';

export const deleteInstrument: NonNullable<MutationResolvers['deleteInstrument']> = async (
  _parent,
  args,
  { prisma },
  info,
) => {
  await prisma.instrument.delete({ where: { pk: args.pk }, ...resolveSelectFields<'Instrument'>(info) });
};
