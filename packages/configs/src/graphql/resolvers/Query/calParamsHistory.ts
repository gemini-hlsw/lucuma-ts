import { resolveSelectFields } from '../query-fields.ts';
import type { QueryResolvers } from './../../gen/types.generated.js';

export const calParamsHistory: NonNullable<QueryResolvers['calParamsHistory']> = async (
  _parent,
  args,
  { prisma },
  info,
) => {
  return prisma.calParams.findMany({
    where: args,
    ...resolveSelectFields<'CalParams'>(info),
    orderBy: { createdAt: 'desc' },
  });
};
