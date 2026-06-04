import { resolveSelectFields } from '../query-fields.ts';
import type { MutationResolvers } from './../../gen/types.generated.ts';

export const updateTarget: NonNullable<MutationResolvers['updateTarget']> = (_parent, args, { prisma }, info) => {
  return prisma.target.update({
    where: { pk: args.pk },
    data: {
      ...args,
      sidereal: args.sidereal
        ? { update: { where: { targetPk: args.pk }, data: { ...args.sidereal, type: args.type } } }
        : undefined,
      nonsidereal: args.nonsidereal ? { update: { where: { targetPk: args.pk }, data: args.nonsidereal } } : undefined,
    },
    ...resolveSelectFields<'Target'>(info),
  });
};
