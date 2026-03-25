import type { Target, WfsType } from '../../../prisma/gen/client.ts';
import type { ConfigurationUpdateInput, GuideLoopUpdateInput, RotatorUpdateInput } from '../../../prisma/gen/models.ts';
import { firstIfOnlyOne } from '../../../util.ts';
import type { Configuration, MutationResolvers, TargetInput, TargetType } from './../../gen/types.generated.js';

export const importObservation: NonNullable<MutationResolvers['importObservation']> = async (
  _parent,
  args,
  { prisma },
) =>
  // Use a transaction to ensure all operations complete successfully together
  prisma.$transaction(async (prisma) => {
    const { configurationPk, rotatorPk, observation, targets, guideEnvironmentAngle, guideLoopPk } = args.input;

    await prisma.target.deleteMany({
      where: {},
    });

    //
    // Targets
    //
    const newTargets: Pick<Target, 'pk' | 'type'>[] = [];
    for (const t of [
      ...targets.base,
      ...targets.oiwfs.map(setWfs('OIWFS')),
      ...targets.pwfs1.map(setWfs('PWFS1')),
      ...targets.pwfs2.map(setWfs('PWFS2')),
    ]) {
      // Create each target individually to handle sidereal and nonsidereal relations
      newTargets.push(
        await prisma.target.create({
          data: {
            ...t,
            sidereal: t.sidereal ? { create: { ...t.sidereal, type: t.type } } : undefined,
            nonsidereal: t.nonsidereal ? { create: t.nonsidereal } : undefined,
          },
          select: {
            pk: true,
            type: true,
          },
        }),
      );
    }

    //
    // Configuration
    //
    const selectedTarget = newTargets.find((t) => t.type === 'BLINDOFFSET' || t.type === 'SCIENCE')?.pk;
    const selectedOiTarget = firstIfOnlyOne(newTargets.filter((t) => t.type === 'OIWFS'))?.pk;
    const selectedP1Target = firstIfOnlyOne(newTargets.filter((t) => t.type === 'PWFS1'))?.pk;
    const selectedP2Target = firstIfOnlyOne(newTargets.filter((t) => t.type === 'PWFS2'))?.pk;
    const selectedGuiderTarget = firstIfOnlyOne([selectedOiTarget, selectedP1Target, selectedP2Target].filter(Boolean));
    const configurationData: ConfigurationUpdateInput = {
      obsId: observation.id,
      obsTitle: observation.title,
      obsSubtitle: observation.subtitle,
      obsReference: observation.reference,
      obsInstrument: observation.instrument,
      baffleMode: 'AUTO',
      centralBaffle: null,
      deployableBaffle: null,
      selectedTarget,
      selectedOiTarget,
      selectedP1Target,
      selectedP2Target,
      selectedGuiderTarget,
    };

    //
    // Rotator
    //
    const angleParsed =
      typeof guideEnvironmentAngle?.degrees === 'string'
        ? parseFloat(guideEnvironmentAngle.degrees)
        : (guideEnvironmentAngle?.degrees ?? 0);
    const rotatorData: RotatorUpdateInput = {
      angle: angleParsed,
      tracking: 'TRACKING',
    };

    //
    // Guide loop
    //
    const selectedGuideSource = determineGuideSource({
      selectedGuiderTarget,
      selectedOiTarget,
      selectedP1Target,
      selectedP2Target,
    });
    const hasSelectedGuideSource = selectedGuideSource !== undefined;
    const guideLoopData: GuideLoopUpdateInput = {
      m2TipTiltEnable: hasSelectedGuideSource,
      m2TipTiltSource: selectedGuideSource ?? '',
      m2FocusEnable: hasSelectedGuideSource,
      m2FocusSource: selectedGuideSource ?? '',
      m2ComaEnable: selectedGuideSource === 'PWFS1' || selectedGuideSource === 'PWFS2',
      m1CorrectionsEnable: hasSelectedGuideSource,
      m2ComaM1CorrectionsSource: selectedGuideSource ?? '',
    };

    // Update configuration, guide loop, and rotator in parallel
    const [configuration, rotator, guideLoop] = await Promise.all([
      prisma.configuration.update({
        where: { pk: configurationPk },
        data: configurationData,
      }) as Promise<Configuration>,
      prisma.rotator.update({
        where: { pk: rotatorPk },
        data: rotatorData,
      }),
      prisma.guideLoop.update({
        where: { pk: guideLoopPk },
        data: guideLoopData,
      }),
      prisma.instrument.deleteMany({ where: { name: observation.instrument, isTemporary: true } }),
    ]);

    return { configuration, rotator, guideLoop };
  });

/**
 * Helper function to force set the WFS type on a target
 */
const setWfs =
  (wfs: TargetType) =>
  (target: TargetInput): TargetInput => ({ ...target, type: wfs });

const determineGuideSource = ({
  selectedGuiderTarget,
  selectedOiTarget,
  selectedP1Target,
  selectedP2Target,
}: {
  selectedGuiderTarget?: number | null;
  selectedOiTarget?: number | null;
  selectedP1Target?: number | null;
  selectedP2Target?: number | null;
}): Exclude<WfsType, 'NONE'> | undefined => {
  if (selectedGuiderTarget === selectedOiTarget) return 'OIWFS';
  if (selectedGuiderTarget === selectedP1Target) return 'PWFS1';
  if (selectedGuiderTarget === selectedP2Target) return 'PWFS2';
  return undefined;
};
