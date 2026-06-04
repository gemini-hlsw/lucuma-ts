import { GraphQLError } from 'graphql';

import { resolveSelectFields } from '../query-fields.ts';
import type { MutationResolvers } from './../../gen/types.generated.js';

export const revertCalParams: NonNullable<MutationResolvers['revertCalParams']> = async (
  _parent,
  args,
  { prisma },
  info,
) => {
  const selectFields = resolveSelectFields<'CalParams'>(info);
  const oldCalParams = await prisma.calParams.findFirst({
    where: { pk: args.pk },
    omit: {
      pk: true,
      comment: true,
      createdAt: true,
    },
    ...selectFields,
  });

  if (!oldCalParams) {
    throw new GraphQLError(`CalParams with pk ${args.pk} not found`);
  }

  return prisma.calParams.create({
    data: {
      ...oldCalParams,
      createdAt: undefined, // Let the database set the createdAt to now
      comment: args.comment,
    },
    ...selectFields,
  });
};
