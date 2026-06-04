import { resolveSelectFields } from '../query-fields.ts';
import type { MutationResolvers } from './../../gen/types.generated.ts';

export const updateGuideAlarm: NonNullable<MutationResolvers['updateGuideAlarm']> = (
  _parent,
  args,
  { prisma },
  info,
) => {
  return prisma.guideAlarm.update({
    where: { wfs: args.wfs },
    data: args,
    ...resolveSelectFields<'GuideAlarm'>(info),
  });
};
