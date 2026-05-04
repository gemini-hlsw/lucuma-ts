import type { WfsItemFragment, WfsType } from '@gql/configs/gen/graphql';
import type { GuideQualityItemFragment, GuideStateItemFragment } from '@gql/server/gen/graphql';

import type { AlarmType } from '@/components/atoms/alarm';

type GuideState = Pick<
  GuideStateItemFragment,
  'm1Input' | 'm2Inputs' | 'mountOffload' | 'p1Integrating' | 'p2Integrating' | 'oiIntegrating'
>;

/**
 * Alarms should trigger only for active WFS that are being used for correction M2 or M1, and only if the guide quality is below the limit or the centroid is not detected.
 */
export function evaluateAlarm(
  alarm: WfsItemFragment | undefined,
  guideQuality: GuideQualityItemFragment | undefined,
  guideState: GuideState | undefined,
): AlarmType | undefined {
  if (!alarm || !guideQuality || !guideState) return undefined;

  const allInputs = [...(guideState.m2Inputs ?? []), guideState.m1Input] as (string | undefined)[];

  const correctingM1OrM2 = allInputs.includes(alarm.wfs);

  const isActive = alarmIsActive(guideState, alarm);

  if (correctingM1OrM2 && isActive) {
    if (!guideQuality.centroidDetected) return 'SUBAPERTURES_BAD';
    if (guideQuality.flux < alarm.limit) return 'GUIDE_COUNTS';
  }
  return undefined;
}

/**
 * In addition to other alarm rules, if a WFS is used for M2 tip/tilt correction and The offloading of corrections to the mount is enabled, the alarm must also produce a sound.
 * Disabling alarms should only stop the sound.
 */
export function evaluateAlarmSound(
  alarm: WfsItemFragment,
  guideQuality: GuideQualityItemFragment,
  guideState: GuideState,
): AlarmType | undefined {
  const correctingM2TipTilt = ((guideState.m2Inputs ?? []) as WfsType[]).includes(alarm.wfs);

  if (alarm.enabled && guideState.mountOffload && correctingM2TipTilt) {
    return evaluateAlarm(alarm, guideQuality, guideState);
  }
  return undefined;
}

function alarmIsActive(guideState: GuideState, alarm: WfsItemFragment): boolean {
  switch (alarm.wfs) {
    case 'OIWFS':
      return guideState.oiIntegrating;
    case 'PWFS1':
      return guideState.p1Integrating;
    case 'PWFS2':
      return guideState.p2Integrating;
    default:
      return false;
  }
}
