import { resolveSelectFields } from '../query-fields.ts';
import type { EngineeringTarget, MutationResolvers } from './../../gen/types.generated.ts';

export const updateEngineeringTarget: NonNullable<MutationResolvers['updateEngineeringTarget']> = (
  _parent,
  args,
  { prisma },
  info,
) => {
  return prisma.engineeringTarget.update({
    where: { pk: args.pk },
    data: args,
    ...resolveSelectFields<'EngineeringTarget'>(info),
  }) as Promise<EngineeringTarget>;
};
