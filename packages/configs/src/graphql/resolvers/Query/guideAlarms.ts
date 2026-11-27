import { resolveSelectFields } from '../query-fields.ts';
import type { GuideAlarm, QueryResolvers, WfsType } from './../../gen/types.generated.ts';

export const guideAlarms: NonNullable<QueryResolvers['guideAlarms']> = async (
  _parent,
  _args,
  { prisma, log },
  info,
) => {
  // The GraphQL fields are WFS types, so only the keys of the select are used, not passed to Prisma.
  const selectedWfs = resolveSelectFields<Partial<Record<WfsType, unknown>> | undefined>(info);
  const wfsTypesToQuery = Object.keys(selectedWfs ?? {}) as WfsType[];
  const alarms = await prisma.guideAlarm.findMany({
    where: {
      wfs: {
        in: wfsTypesToQuery,
      },
    },
  });

  if (!alarms.length) {
    log.warn(`No guide alarms found for wfs types: ${wfsTypesToQuery.join(', ')}`);
  }

  // Convert the array of alarms to an object with the wfs as the key
  return Object.fromEntries(alarms.map((alarm) => [alarm.wfs, alarm])) as Record<WfsType, GuideAlarm>;
};
