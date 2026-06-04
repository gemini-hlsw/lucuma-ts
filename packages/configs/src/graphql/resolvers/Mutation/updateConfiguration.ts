import { resolveSelectFields } from '../query-fields.ts';
import type { Configuration, MutationResolvers } from './../../gen/types.generated.ts';

export const updateConfiguration: NonNullable<MutationResolvers['updateConfiguration']> = (
  _parent,
  args,
  { prisma },
  info,
) => {
  return prisma.configuration.update({
    where: { pk: args.pk },
    data: args,
    ...resolveSelectFields<'Configuration'>(info),
  }) as Promise<Configuration>;
};
