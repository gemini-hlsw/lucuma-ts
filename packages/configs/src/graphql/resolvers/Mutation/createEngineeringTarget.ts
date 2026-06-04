import { resolveSelectFields } from '../query-fields.ts';
import type { EngineeringTarget, MutationResolvers } from './../../gen/types.generated.ts';

export const createEngineeringTarget: NonNullable<MutationResolvers['createEngineeringTarget']> = (
  _parent,
  args,
  { prisma },
  info,
) => {
  if (args.type === 'FIXED') {
    // Some logics depending on the input
    delete Object.assign(args, { coord1: args.ra }).ra;
    delete Object.assign(args, { coord2: args.dec }).dec;
  } else {
    delete Object.assign(args, { coord1: args.ra }).ra;
    delete Object.assign(args, { coord2: args.dec }).dec;
  }
  return prisma.engineeringTarget.create({
    data: args as typeof args & { coord1: number; coord2: number },
    ...resolveSelectFields<'EngineeringTarget'>(info),
  }) as Promise<EngineeringTarget>;
};
