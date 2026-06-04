import { GraphQLError } from 'graphql';

import { INITIAL_CAL_PARAMS } from '../../../prisma/queries/init/calParams.ts';
import { resolveSelectFields } from '../query-fields.ts';
import type { QueryResolvers } from './../../gen/types.generated.js';

export const calParams: NonNullable<QueryResolvers['calParams']> = async (_parent, args, { prisma }, info) => {
  const calParams = await prisma.calParams.findFirst({
    where: { site: args.site },
    orderBy: { createdAt: 'desc' },
    ...resolveSelectFields<'CalParams'>(info),
  });

  if (calParams) {
    return calParams;
  } else {
    const initialCalParams = INITIAL_CAL_PARAMS.find((cp) => cp.site === args.site);
    if (initialCalParams) {
      return prisma.calParams.create({
        data: initialCalParams,
      });
    } else {
      throw new GraphQLError(`No initial CalParams found for site ${args.site}`);
    }
  }
};
