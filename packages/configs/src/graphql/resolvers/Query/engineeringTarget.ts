import { resolveSelectFields } from '../query-fields.ts';
import type { EngineeringTarget, QueryResolvers } from './../../gen/types.generated.ts';

export const engineeringTarget: NonNullable<QueryResolvers['engineeringTarget']> = (
  _parent,
  args,
  { prisma },
  info,
) => {
  return prisma.engineeringTarget.findFirst({
    where: args,
    ...resolveSelectFields<'EngineeringTarget'>(info),
  }) as Promise<EngineeringTarget | null>;
};
