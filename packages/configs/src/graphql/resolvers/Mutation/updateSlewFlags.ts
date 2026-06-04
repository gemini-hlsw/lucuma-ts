import { resolveSelectFields } from '../query-fields.ts';
import type { MutationResolvers } from './../../gen/types.generated.ts';

export const updateSlewFlags: NonNullable<MutationResolvers['updateSlewFlags']> = (_parent, args, { prisma }, info) => {
  return prisma.slewFlags.update({
    where: { pk: args.pk },
    data: args,
    ...resolveSelectFields<'SlewFlags'>(info),
  });
};
