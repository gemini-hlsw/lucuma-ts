import type { MutationResolvers } from '../../gen/types.generated.ts';
import { resolveSelectFields } from '../query-fields.ts';

export const createCalParams: NonNullable<MutationResolvers['createCalParams']> = (_parent, args, { prisma }, info) => {
  return prisma.calParams.create({
    data: args.input,
    ...resolveSelectFields<'CalParams'>(info),
  });
};
