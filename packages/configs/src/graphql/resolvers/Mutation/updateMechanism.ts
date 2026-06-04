import { resolveSelectFields } from '../query-fields.ts';
import type { MutationResolvers } from './../../gen/types.generated.ts';

export const updateMechanism: NonNullable<MutationResolvers['updateMechanism']> = (_parent, args, { prisma }, info) => {
  return prisma.mechanism.update({
    where: { pk: args.pk },
    data: args,
    ...resolveSelectFields<'Mechanism'>(info),
  });
};
