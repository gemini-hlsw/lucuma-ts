import type { Target } from '../../../prisma/gen/client.ts';
import { resolveSelectFields } from '../query-fields.ts';
import type { MutationResolvers } from './../../gen/types.generated.ts';

export const removeAndCreateBaseTargets: NonNullable<MutationResolvers['removeAndCreateBaseTargets']> = async (
  _parent,
  args,
  { prisma },
  info,
) =>
  prisma.$transaction(async (prisma) => {
    await prisma.target.deleteMany({
      where: {},
    });

    const newTargets: Target[] = [];

    for (const t of args.targets ?? []) {
      // Create each target individually to handle sidereal and nonsidereal relations
      const result = await prisma.target.create({
        data: {
          ...t,
          sidereal: t.sidereal ? { create: { ...t.sidereal, type: t.type } } : undefined,
          nonsidereal: t.nonsidereal ? { create: t.nonsidereal } : undefined,
        },
        ...resolveSelectFields<'Target'>(info),
      });
      newTargets.push(result);
    }

    return newTargets;
  });
