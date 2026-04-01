import { when } from '@gemini-hlsw/lucuma-common-ui';
import { useCalParams } from '@gql/configs/CalParams';
import { useConfiguration } from '@gql/configs/Configuration';
import type {
  CalParams,
  Configuration,
  InstrumentConfig,
  NonsiderealTarget,
  Rotator,
  SiderealTarget,
  Target,
  UpdateConfigurationMutationVariables,
} from '@gql/configs/gen/graphql';
import { useConfiguredInstrument } from '@gql/configs/Instrument';
import { useRotator } from '@gql/configs/Rotator';
import { useTargets } from '@gql/configs/Target';
import type { NonsiderealInput } from '@gql/odb/gen/graphql';
import type {
  AzElTargetInput,
  BaffleConfigInput,
  GuiderConfig,
  InstrumentSpecificsInput,
  RotatorTrackingInput,
  SiderealInput,
  TargetPropertiesInput,
  TcsConfigInput,
} from '@gql/server/gen/graphql';

import { useServerConfigValue } from '@/components/atoms/config';
import type { TypeOfTarget } from '@/types';

export function createRotatorTrackingInput(rotator: Rotator): RotatorTrackingInput {
  return { ipa: { degrees: rotator.angle }, mode: rotator.tracking };
}

export function createInstrumentSpecificsInput(instrument: InstrumentConfig): InstrumentSpecificsInput {
  return {
    iaa: { degrees: instrument.iaa },
    focusOffset: { micrometers: instrument.focusOffset },
    agName: instrument.name,
    origin: { x: { arcseconds: instrument.originX }, y: { arcseconds: instrument.originY } },
  };
}

export function createTargetPropertiesInput(target: Target): TargetPropertiesInput {
  return {
    id: target.id,
    name: target.name,
    sidereal: when(target.type !== 'FIXED' && target.sidereal, createSiderealInput),
    nonsidereal: when(target.type !== 'FIXED' && target.nonsidereal, createNonsiderealInput),
    azel: when(target.type === 'FIXED', () => createAzElTargetInput(target)),
    wavelength: when(target.wavelength, (w) => ({ nanometers: w })),
  };
}

function createAzElTargetInput(target: Target): AzElTargetInput | undefined {
  return when(target.sidereal?.az, (az) =>
    when(target.sidereal?.el, (el) => ({
      azimuth: { degrees: az.degrees },
      elevation: { degrees: el.degrees },
    })),
  );
}

export function createSiderealInput(target: SiderealTarget): SiderealInput {
  return {
    ra: when(target.ra, ({ hms }) => ({ hms })),
    dec: when(target.dec, ({ dms }) => ({ dms })),
    epoch: target.epoch,
    properMotion: when(target.properMotion, ({ ra, dec }) => ({
      ra: {
        microarcsecondsPerYear: ra,
      },
      dec: {
        microarcsecondsPerYear: dec,
      },
    })),
    radialVelocity: when(target.radialVelocity, (rv) => ({
      centimetersPerSecond: rv,
    })),
    parallax: when(target.parallax, (p) => ({
      microarcseconds: p,
    })),
  };
}

export function createNonsiderealInput(target: NonsiderealTarget): NonsiderealInput {
  return {
    des: target.des,
    keyType: target.keyType,
  };
}

export function createBafflesInput(
  calParams: Pick<CalParams, 'baffleVisible' | 'baffleNearIR'>,
  configuration: Pick<Configuration, 'baffleMode' | 'centralBaffle' | 'deployableBaffle'>,
): BaffleConfigInput | undefined {
  switch (configuration.baffleMode) {
    case 'AUTO':
      return {
        autoConfig: {
          nearirLimit: { micrometers: calParams.baffleNearIR },
          visibleLimit: { micrometers: calParams.baffleVisible },
        },
      };
    case 'MANUAL':
      return {
        manualConfig: {
          centralBaffle: configuration.centralBaffle!,
          deployableBaffle: configuration.deployableBaffle!,
        },
      };
    case 'IGNORED':
      return undefined;
    default:
      console.warn(`Unknown baffle mode: ${String(configuration.baffleMode)}`);
      return undefined;
  }
}

function createGuiderConfig(target: Target): GuiderConfig {
  return {
    tracking: {
      // TODO: this should be selected depending on the "GuiderFooter" dropdown value!
      nodAchopA: true,
      nodAchopB: false,
      nodBchopA: false,
      nodBchopB: true,
    },
    target: {
      name: target.name,
      sidereal: when(target.sidereal, createSiderealInput),
      nonsidereal: when(target.nonsidereal, createNonsiderealInput),
    },
  };
}

export function createTcsConfigInput(
  instrument: InstrumentConfig,
  rotator: Rotator,
  target: Target,
  oiTarget: Target | undefined,
  p1Target: Target | undefined,
  p2Target: Target | undefined,
  calParams: Pick<CalParams, 'baffleVisible' | 'baffleNearIR'>,
  configuration: Pick<Configuration, 'baffleMode' | 'centralBaffle' | 'deployableBaffle'>,
): TcsConfigInput {
  const rotatorInput = createRotatorTrackingInput(rotator);

  const instrumentInput = createInstrumentSpecificsInput(instrument);

  const targetInput = createTargetPropertiesInput(target);

  const bafflesInput = createBafflesInput(calParams, configuration);

  return {
    instrument: instrument.name,
    instParams: instrumentInput,
    rotator: rotatorInput,
    sourceATarget: targetInput,
    baffles: bafflesInput,
    oiwfs: when(oiTarget, createGuiderConfig),
    pwfs1: when(p1Target, createGuiderConfig),
    pwfs2: when(p2Target, createGuiderConfig),
  };
}

/**
 * Create TCS config input from current configuration, instrument, rotator and target.
 *
 * @returns either the input data, or a detail string explaining why it could not be created.
 */
export function useTcsConfigInput():
  | { data: TcsConfigInput; loading: boolean; detail: undefined }
  | { data: undefined; loading: boolean; detail: string } {
  const { site } = useServerConfigValue();

  const { data: configurationData, loading: configurationLoading } = useConfiguration();
  const configuration = configurationData?.configuration;

  const { data: instrument, loading: instrumentLoading } = useConfiguredInstrument();

  const { data: rotatorData, loading: rotatorLoading } = useRotator();
  const rotator = rotatorData?.rotator;

  const { data: targetsData, loading: targetsLoading } = useTargets();
  const { baseTargets, oiTargets, p1Targets, p2Targets } = targetsData;

  const { data: calParamsData, loading: calParamsLoading } = useCalParams(site);
  const calParams = calParamsData?.calParams;

  const loading = configurationLoading || instrumentLoading || rotatorLoading || targetsLoading || calParamsLoading;

  const baseTarget = baseTargets.find((t) => t.pk === configuration?.selectedTarget);

  if (!instrument || !rotator || !baseTarget || !calParams || !configuration) {
    let detail: string;
    if (!instrument) {
      detail = 'No instrument';
    } else if (!rotator) {
      detail = 'No rotator';
    } else if (!baseTarget) {
      detail = 'No target';
    } else if (!calParams) {
      detail = 'No cal params configuration';
    } else if (!configuration) {
      detail = 'No configuration';
    } else {
      detail = 'Unknown error';
    }
    return { data: undefined, loading, detail };
  }

  const oiTarget = oiTargets.find((t) => t.pk === configuration?.selectedOiTarget);
  const p1Target = p1Targets.find((t) => t.pk === configuration?.selectedP1Target);
  const p2Target = p2Targets.find((t) => t.pk === configuration?.selectedP2Target);

  const data = createTcsConfigInput(
    instrument,
    rotator,
    baseTarget,
    oiTarget,
    p1Target,
    p2Target,
    calParams,
    configuration,
  );

  return { data, loading, detail: undefined };
}

export function createUpdateSelectedTargetVariables(
  configurationPk: number,
  type: TypeOfTarget | undefined,
  targetPk: number,
) {
  const variables: Pick<
    UpdateConfigurationMutationVariables,
    'pk' | 'selectedOiTarget' | 'selectedP1Target' | 'selectedP2Target' | 'selectedTarget' | 'selectedGuiderTarget'
  > = { pk: configurationPk };
  switch (type) {
    case 'OIWFS':
      variables.selectedGuiderTarget = targetPk;
      variables.selectedOiTarget = targetPk;
      break;
    case 'PWFS1':
      variables.selectedGuiderTarget = targetPk;
      variables.selectedP1Target = targetPk;
      break;
    case 'PWFS2':
      variables.selectedGuiderTarget = targetPk;
      variables.selectedP2Target = targetPk;
      break;
    default:
    case 'SCIENCE':
    case 'BLINDOFFSET':
    case 'FIXED':
      variables.selectedTarget = targetPk;
      break;
  }
  return variables;
}
