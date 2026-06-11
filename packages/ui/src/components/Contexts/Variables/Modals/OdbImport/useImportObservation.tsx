import { isNotNullish, when } from '@gemini-hlsw/lucuma-common-ui';
import { useConfiguration } from '@gql/configs/Configuration';
import type { TargetInput, TargetType } from '@gql/configs/gen/graphql';
import { useGetGuideLoop } from '@gql/configs/GuideLoop';
import { useRotator } from '@gql/configs/Rotator';
import { useDoImportObservation } from '@gql/configs/Target';
import type {
  BasePositionItemFragment as BasePosition,
  ObservationItemFragment as OdbObservation,
  TargetItemFragment as OdbTarget,
} from '@gql/odb/gen/graphql';
import { useGetCentralWavelength, useGetGuideEnvironment } from '@gql/odb/Observation';
import { toTrackingMode } from '@Telescope/Targets/inputs';

import { extractMagnitude } from '@/Helpers/bands';
import { extractGuideTargets } from '@/Helpers/guideTargets';
import { useTransitionPromise } from '@/Helpers/hooks';
import { extractCentralWavelength } from '@/Helpers/wavelength';

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

  function importObservation(selectedObservation: OdbObservation): Promise<void> {
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

      const { wavelength, fpu } = extractCentralWavelength(
        obsWithWavelength.data,
        guideEnv.data?.observation?.observingMode?.visitor,
      );

      const base = createBaseTargets(
        selectedObservation,
        guideEnv.data?.observation?.targetEnvironment.basePosition,
        wavelength,
      );

      const { oiwfs, pwfs1, pwfs2 } = extractGuideTargets(guideEnv.data);

      await doImportObservation({
        variables: {
          input: {
            configurationPk: configuration.pk,
            guideLoopPk: guideLoop.pk,
            observation: {
              id: selectedObservation.id,
              title: selectedObservation.title,
              subtitle: selectedObservation.subtitle,
              reference: selectedObservation.reference?.label,
              instrument: obsWithWavelength.data?.executionConfig?.instrument,
              fpu,
            },
            targets: {
              base: base,
              oiwfs,
              pwfs1,
              pwfs2,
            },
            rotator: {
              pk: rotator.pk,
              angle: when(guideEnv.data?.observation?.targetEnvironment.guideEnvironment.posAngle.degrees, parseNumber),
              tracking: when(guideEnv.data?.observation?.targetEnvironment.cassRotator, toTrackingMode),
            },
          },
        },
      });
    });
  }

  return [importObservation, { loading }] as const;
}

function createBaseTarget(target: OdbTarget, type: TargetType, wavelength: number | undefined): TargetInput {
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

function createBaseTargets(
  observation: OdbObservation,
  basePosition: BasePosition | null | undefined,
  wavelength: number | undefined,
): TargetInput[] {
  const targetEnvironment = observation.targetEnvironment;

  const asterism = targetEnvironment.asterism;
  const fallbackTargets = [targetEnvironment.blindOffsetTarget, targetEnvironment.firstScienceTarget].filter(
    isNotNullish,
  );
  const sourceTargets = asterism.length > 0 ? asterism : fallbackTargets;

  const matchingBaseTarget = when(basePosition, (base) =>
    sourceTargets.find((target) => isSameBaseTarget(base, target)),
  );
  const orderedBaseTargets: TargetInput[] = [];
  const seenTargetIds = new Set<string>();

  const baseTarget = createBasePositionTarget(basePosition, matchingBaseTarget, targetEnvironment, wavelength);
  if (baseTarget) {
    orderedBaseTargets.push(baseTarget);
    seenTargetIds.add(baseTarget.id);
  }

  for (const target of sourceTargets) {
    if (seenTargetIds.has(target.id)) continue;
    orderedBaseTargets.push(createBaseTarget(target, getBaseTargetType(target, targetEnvironment), wavelength));
    seenTargetIds.add(target.id);
  }

  return orderedBaseTargets;
}

function getBaseTargetType(
  target: OdbTarget,
  targetEnvironment: NonNullable<OdbObservation['targetEnvironment']>,
): TargetType {
  return target.id === targetEnvironment.blindOffsetTarget?.id ? 'BLINDOFFSET' : 'SCIENCE';
}

function createBasePositionTarget(
  basePosition: BasePosition | null | undefined,
  matchingTarget: OdbTarget | undefined,
  targetEnvironment: NonNullable<OdbObservation['targetEnvironment']>,
  wavelength: number | undefined,
): TargetInput | undefined {
  if (!basePosition) return undefined;
  if (matchingTarget)
    return createBaseTarget(matchingTarget, getBaseTargetType(matchingTarget, targetEnvironment), wavelength);

  const defaultTargetInput = {
    id: 't-101',
    name: basePosition.name,
    type: 'SCIENCE',
    wavelength,
  } satisfies Partial<TargetInput>;

  if (basePosition.nonsidereal) {
    return {
      ...defaultTargetInput,
      nonsidereal: basePosition.nonsidereal,
    };
  }

  if (basePosition.sidereal) {
    return {
      ...defaultTargetInput,
      sidereal: {
        coord1: parseNumber(basePosition.sidereal.ra.degrees),
        coord2: parseNumber(basePosition.sidereal.dec.degrees),
        pmRa: basePosition.sidereal.properMotion?.ra.microarcsecondsPerYear,
        pmDec: basePosition.sidereal.properMotion?.dec.microarcsecondsPerYear,
        radialVelocity: basePosition.sidereal.radialVelocity?.centimetersPerSecond,
        parallax: basePosition.sidereal.parallax?.microarcseconds,
        epoch: basePosition.sidereal.epoch,
      },
    };
  }

  if (basePosition.coordinates) {
    return {
      ...defaultTargetInput,
      sidereal: {
        coord1: parseNumber(basePosition.coordinates.ra.degrees),
        coord2: parseNumber(basePosition.coordinates.dec.degrees),
      },
    };
  }

  return undefined;
}

function isSameBaseTarget(basePosition: BasePosition, target: OdbTarget): boolean {
  if (basePosition.nonsidereal && target.nonsidereal) {
    return (
      basePosition.nonsidereal.des === target.nonsidereal.des &&
      basePosition.nonsidereal.keyType === target.nonsidereal.keyType
    );
  }

  const baseCoordinates = basePosition.sidereal ?? basePosition.coordinates;
  if (baseCoordinates && target.sidereal) {
    return (
      parseNumber(baseCoordinates.ra.degrees) === parseNumber(target.sidereal.ra.degrees) &&
      parseNumber(baseCoordinates.dec.degrees) === parseNumber(target.sidereal.dec.degrees)
    );
  }

  return false;
}

function parseNumber(value: number | string): number {
  return typeof value === 'string' ? parseFloat(value) : value;
}
