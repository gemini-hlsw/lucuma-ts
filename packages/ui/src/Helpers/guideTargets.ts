import type { GetGuideEnvironmentQuery } from '@gql/odb/gen/graphql';

import type { TargetInput } from '@/types';

import { extractMagnitude } from './bands';

export function extractGuideTargets(data: GetGuideEnvironmentQuery | undefined) {
  return (data?.observation?.targetEnvironment.guideEnvironment.guideTargets ?? []).reduce<
    Record<'oiwfs' | 'pwfs1' | 'pwfs2', TargetInput[]>
  >(
    (acc, t, i) => {
      const { name: band, value: magnitude } = extractMagnitude(t.sourceProfile);
      const auxTarget: Omit<TargetInput, 'type'> = {
        id: `t-${i + 1}`,
        name: t.name,
        sidereal: {
          epoch: t.sidereal?.epoch,
          coord1:
            typeof t.sidereal?.ra.degrees === 'string'
              ? parseFloat(t.sidereal.ra.degrees)
              : (t.sidereal?.ra.degrees ?? 0),
          coord2:
            typeof t.sidereal?.dec.degrees === 'string'
              ? parseFloat(t.sidereal.dec.degrees)
              : (t.sidereal?.dec.degrees ?? 0),
          pmRa: t.sidereal?.properMotion?.ra.microarcsecondsPerYear,
          pmDec: t.sidereal?.properMotion?.dec.microarcsecondsPerYear,
          radialVelocity: t.sidereal?.radialVelocity?.centimetersPerSecond,
          parallax: t.sidereal?.parallax?.microarcseconds,
        },
        magnitude: magnitude,
        band: band,
      };
      if (t.probe.endsWith('OIWFS')) {
        acc.oiwfs.push({ ...auxTarget, type: 'OIWFS' });
      } else if (t.probe === 'PWFS1') {
        acc.pwfs1.push({ ...auxTarget, type: 'PWFS1' });
      } else if (t.probe === 'PWFS2') {
        acc.pwfs2.push({ ...auxTarget, type: 'PWFS2' });
      } else {
        console.warn('Unknown guide target:', t);
      }
      return acc;
    },
    { oiwfs: [], pwfs1: [], pwfs2: [] },
  );
}
