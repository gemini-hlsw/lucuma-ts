import { parseNumber, when } from '@gemini-hlsw/lucuma-common-ui';
import type { TargetInput } from '@gql/configs/gen/graphql';
import type { GetGuideEnvironmentQuery } from '@gql/odb/gen/graphql';

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
        sidereal: when(t.sidereal, (s) => ({
          epoch: s.epoch,
          coord1: parseNumber(s.ra.degrees),
          coord2: parseNumber(s.dec.degrees),
          pmRa: s.properMotion?.ra.microarcsecondsPerYear,
          pmDec: s.properMotion?.dec.microarcsecondsPerYear,
          radialVelocity: s.radialVelocity?.centimetersPerSecond,
          parallax: s.parallax?.microarcseconds,
        })),
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
