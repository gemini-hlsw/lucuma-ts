import { resolveSelectFields } from '../query-fields.ts';
import type { EngineeringTarget, QueryResolvers } from './../../gen/types.generated.ts';

export const engineeringTargets: NonNullable<QueryResolvers['engineeringTargets']> = (
  _parent,
  args,
  { prisma },
  info,
) => {
  return prisma.engineeringTarget.findMany({
    where: args,
    orderBy: { pk: 'asc' },
    ...resolveSelectFields<'EngineeringTarget'>(info),
  }) as Promise<EngineeringTarget[]>;
};
