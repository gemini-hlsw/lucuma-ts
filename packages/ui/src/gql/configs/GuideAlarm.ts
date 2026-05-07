import { useMutation, useQuery } from '@apollo/client/react';

import { graphql } from './gen';
import type { WfsType } from './gen/graphql';

export const GUIDE_ALARM_FRAGMENT = graphql(`
  fragment GuideAlarmItem on GuideAlarm {
    wfs
    limit
    enabled
  }
`);

export const GET_GUIDE_ALARMS = graphql(`
  query guideAlarms {
    guideAlarms {
      OIWFS {
        ...GuideAlarmItem
      }
      PWFS1 {
        ...GuideAlarmItem
      }
      PWFS2 {
        ...GuideAlarmItem
      }
    }
  }
`);

export function useGuideAlarms() {
  return useQuery(GET_GUIDE_ALARMS, {
    context: { clientName: 'navigateConfigs' },
  });
}

export const UPDATE_GUIDE_ALARM = graphql(`
  mutation updateGuideAlarm($wfs: WfsType!, $enabled: Boolean, $limit: Int) {
    updateGuideAlarm(wfs: $wfs, enabled: $enabled, limit: $limit) {
      ...GuideAlarmItem
    }
  }
`);

export function useUpdateGuideAlarm() {
  const guideAlarms = useGuideAlarms().data?.guideAlarms;
  return useMutation(UPDATE_GUIDE_ALARM, {
    context: { clientName: 'navigateConfigs' },
    optimisticResponse: (vars, { IGNORE }) => {
      const alarm = guideAlarms?.[vars.wfs as Exclude<WfsType, 'NONE'>];
      return alarm
        ? {
            updateGuideAlarm: {
              ...alarm,
              ...vars,
            } as typeof alarm,
          }
        : IGNORE;
    },
  });
}
