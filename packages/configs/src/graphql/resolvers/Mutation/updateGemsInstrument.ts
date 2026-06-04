import { resolveSelectFields } from '../query-fields.ts';
import type { MutationResolvers } from './../../gen/types.generated.ts';

export const updateGemsInstrument: NonNullable<MutationResolvers['updateGemsInstrument']> = (
  _parent,
  args,
  { prisma },
  info,
) => {
  return prisma.gemsInstrument.update({
    where: { pk: args.pk },
    data: args,
    ...resolveSelectFields<'GemsInstrument'>(info),
  });
};
