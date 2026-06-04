import { resolveSelectFields } from '../query-fields.ts';
import type { QueryResolvers } from './../../gen/types.generated.ts';

export const targets: NonNullable<QueryResolvers['targets']> = (_parent, args, { prisma }, info) => {
  return prisma.target.findMany({
    where: args,
    orderBy: { createdAt: 'desc' },
    ...resolveSelectFields<'Target'>(info),
  });
};
