import { resolveSelectFields } from '../query-fields.ts';
import type { Configuration, MutationResolvers } from './../../gen/types.generated.ts';

export const createConfiguration: NonNullable<MutationResolvers['createConfiguration']> = (
  _parent,
  args,
  { prisma },
  info,
) => {
  return prisma.configuration.create({
    data: args,
    ...resolveSelectFields<'Configuration'>(info),
  }) as Promise<Configuration>;
};
