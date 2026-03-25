import { useConfiguration } from '@gql/configs/Configuration';
import type { TargetType } from '@gql/configs/gen/graphql';
import { useGetGuideLoop } from '@gql/configs/GuideLoop';
import { useRotator } from '@gql/configs/Rotator';
import { useDoImportObservation } from '@gql/configs/Target';
import { useGetCentralWavelength, useGetGuideEnvironment } from '@gql/odb/Observation';
import { isNotNullish, when } from 'lucuma-common-ui';

import { extractMagnitude } from '@/Helpers/bands';
import { extractGuideTargets } from '@/Helpers/guideTargets';
import { useTransitionPromise } from '@/Helpers/hooks';
import { extractCentralWavelength } from '@/Helpers/wavelength';
import type { OdbObservationType, OdbTargetType, TargetInput } from '@/types';

export function useImportObservation() {
  const { data: configurationData, loading: configurationLoading } = useConfiguration();
  const configuration = configurationData?.configuration;
  const { data: rotatorData, loading: rotatorLoading } = useRotator();
  const rotator = rotatorData?.rotator;
  const { data: guideLoopData, loading: guideLoopLoading } = useGetGuideLoop();
  const guideLoop = guideLoopData?.guideLoop;

  const [getGuideEnvironment, { loading: getGuideEnvironmentLoading }] = useGetGuideEnvironment();
  const [getCentralWavelength, { loading: getCentralWavelengthLoading }] = useGetCentralWavelength();
  const [doImportObservation, { loading: doImportObservationLoading }] = useDoImportObservation();

  const [isPending, startTransition] = useTransitionPromise();

  const loading =
    configurationLoading ||
    rotatorLoading ||
    getGuideEnvironmentLoading ||
    getCentralWavelengthLoading ||
    doImportObservationLoading ||
    guideLoopLoading ||
    isPending;

  function importObservation(selectedObservation: OdbObservationType): Promise<void> {
    if (!configuration || !rotator || !guideLoop) return Promise.resolve();

    return startTransition(async () => {
      // First try to get a central wavelength associated to the observation
      // Get the guide environment separately to avoid large query times for _all_ observations
      const [obsWithWavelength, guideEnv] = await Promise.all([
        getCentralWavelength({
          context: { clientName: 'odb' },
          variables: { obsId: selectedObservation.id },
        }),
        getGuideEnvironment({
          context: { clientName: 'odb' },
          variables: { obsId: selectedObservation.id },
        }),
      ]);

      const wavelength = extractCentralWavelength(selectedObservation.instrument, obsWithWavelength.data);

      const { blindOffsetTarget, firstScienceTarget } = selectedObservation.targetEnvironment ?? {};

      const base = [
        blindOffsetTarget && { target: blindOffsetTarget, type: 'BLINDOFFSET' as const satisfies TargetType },
        firstScienceTarget && { target: firstScienceTarget, type: 'SCIENCE' as const satisfies TargetType },
      ]
        .filter(isNotNullish)
        .map(({ target, type }) => createBaseTarget(target, type, wavelength));

      const { oiwfs, pwfs1, pwfs2 } = extractGuideTargets(guideEnv.data);

      await doImportObservation({
        variables: {
          input: {
            configurationPk: configuration.pk,
            rotatorPk: rotator.pk,
            guideLoopPk: guideLoop.pk,
            observation: {
              id: selectedObservation.id,
              title: selectedObservation.title,
              subtitle: selectedObservation.subtitle,
              reference: selectedObservation.reference?.label,
              instrument: selectedObservation.instrument,
            },
            targets: {
              base: base,
              oiwfs,
              pwfs1,
              pwfs2,
            },
            guideEnvironmentAngle: when(
              guideEnv.data?.observation?.targetEnvironment.guideEnvironment.posAngle.degrees,
              (degrees) => ({
                degrees,
              }),
            ),
          },
        },
      });
    });
  }

  return [importObservation, { loading }] as const;
}

function createBaseTarget(target: OdbTargetType, type: TargetType, wavelength: number | undefined): TargetInput {
  const { name: band, value: magnitude } = extractMagnitude(target.sourceProfile);
  return {
    id: target.id,
    name: target.name,
    sidereal: when(target.sidereal, (s) => ({
      coord1: typeof s.ra.degrees === 'string' ? parseFloat(s.ra.degrees) : s.ra.degrees,
      coord2: typeof s.dec.degrees === 'string' ? parseFloat(s.dec.degrees) : s.dec.degrees,
      pmRa: s.properMotion?.ra.microarcsecondsPerYear,
      pmDec: s.properMotion?.dec.microarcsecondsPerYear,
      radialVelocity: s.radialVelocity?.centimetersPerSecond,
      parallax: s.parallax?.microarcseconds,
      epoch: s.epoch,
    })),
    nonsidereal: when(target.nonsidereal, (n) => ({
      des: n.des,
      keyType: n.keyType,
    })),
    magnitude,
    band,
    type,
    wavelength,
  };
}
