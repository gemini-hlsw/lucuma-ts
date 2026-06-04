import { resolveSelectFields } from '../query-fields.ts';
import type { MutationResolvers } from './../../gen/types.generated.ts';

export const updateAltairInstrument: NonNullable<MutationResolvers['updateAltairInstrument']> = (
  _parent,
  args,
  { prisma },
  info,
) => {
  return prisma.altairInstrument.update({
    where: { pk: args.pk },
    data: args,
    ...resolveSelectFields<'AltairInstrument'>(info),
  });
};
