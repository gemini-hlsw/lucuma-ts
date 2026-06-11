import type { Target, WfsType } from '../../../prisma/gen/client.ts';
import type { ConfigurationUpdateInput, GuideLoopUpdateInput } from '../../../prisma/gen/models.ts';
import { firstIfOnlyOne } from '../../../util.ts';
import type { Configuration, MutationResolvers, TargetInput, TargetType } from './../../gen/types.generated.js';

export const importObservation: NonNullable<MutationResolvers['importObservation']> = async (
  _parent,
  { input },
  { prisma, log },
) =>
  // Use a transaction to ensure all operations complete successfully together
  prisma.$transaction(async (prisma) => {
    const { configurationPk, rotator, observation, targets, guideLoopPk } = input;

    const { count } = await prisma.target.deleteMany({
      where: {},
    });
    log.debug(`Deleted ${count} existing targets for observation import`);

    //
    // Targets
    //
    const newTargets: Pick<Target, 'pk' | 'type'>[] = [];
    const newTargetsToCreate = [
      ...targets.base,
      ...targets.oiwfs.map(setWfs('OIWFS')),
      ...targets.pwfs1.map(setWfs('PWFS1')),
      ...targets.pwfs2.map(setWfs('PWFS2')),
    ];
    log.debug(
      `Creating ${newTargetsToCreate.length} targets (${targets.base.length} base), (${targets.oiwfs.length} OIWFS), (${targets.pwfs1.length} PWFS1), (${targets.pwfs2.length} PWFS2) for observation import`,
    );
    for (const t of newTargetsToCreate) {
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
      fpu: observation.fpu,
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
    const [configuration, newRotator, guideLoop] = await Promise.all([
      prisma.configuration.update({
        where: { pk: configurationPk },
        data: configurationData,
      }) as Promise<Configuration>,
      prisma.rotator.update({
        where: { pk: rotator.pk },
        data: rotator,
      }),
      prisma.guideLoop.update({
        where: { pk: guideLoopPk },
        data: guideLoopData,
      }),
      prisma.instrument.deleteMany({ where: { name: observation.instrument, isTemporary: true } }),
    ]);

    log.debug(`Observation import for ${observation.id} completed`);
    return { configuration, rotator: newRotator, guideLoop };
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
