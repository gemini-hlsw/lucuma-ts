import { resolveSelectFields } from '../query-fields.ts';
import type { MutationResolvers } from './../../gen/types.generated.ts';

export const updateAltairGuideLoop: NonNullable<MutationResolvers['updateAltairGuideLoop']> = (
  _parent,
  args,
  { prisma },
  info,
) => {
  return prisma.altairGuideLoop.update({
    where: { pk: args.pk },
    data: args,
    ...resolveSelectFields<'AltairGuideLoop'>(info),
  });
};
