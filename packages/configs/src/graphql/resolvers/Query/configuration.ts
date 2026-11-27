import { resolveSelectFields } from '../query-fields.ts';
import type { Configuration, QueryResolvers } from './../../gen/types.generated.ts';

export const configuration: NonNullable<QueryResolvers['configuration']> = (_parent, args, { prisma }, info) => {
  return prisma.configuration.findFirst({
    where: args,
    select: resolveSelectFields(info),
  }) as Promise<Configuration | null>;
};
