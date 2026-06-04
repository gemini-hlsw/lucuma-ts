import type { GetCentralWavelengthQuery } from '@gql/odb/gen/graphql';

export function extractCentralWavelength(data: GetCentralWavelengthQuery | undefined) {
  const config = data?.executionConfig;
  if (!config) return undefined;

  // TODO: Add other instruments when odb supports them
  let instrumentName: keyof typeof config;
  switch (config.instrument) {
    case 'FLAMINGOS2':
      instrumentName = 'flamingos2';
      break;
    case 'GMOS_NORTH':
      instrumentName = 'gmosNorth';
      break;
    case 'GMOS_SOUTH':
      instrumentName = 'gmosSouth';
      break;
    case 'GHOST':
      instrumentName = 'ghost';
      break;
    case 'IGRINS2':
      instrumentName = 'igrins2';
      break;
    default:
      return undefined;
  }

  if (instrumentName === 'ghost' || instrumentName === 'igrins2') {
    return {
      wavelength: config[instrumentName]?.science?.nextAtom.steps[0]?.instrumentConfig.centralWavelength?.nanometers,
      fpu: null,
    };
  } else {
    return {
      wavelength: (
        config[instrumentName]?.acquisition?.nextAtom.steps[0] ?? config[instrumentName]?.science?.nextAtom.steps[0]
      )?.instrumentConfig.centralWavelength?.nanometers,
      fpu: config[instrumentName]?.acquisition?.nextAtom.steps[0]?.instrumentConfig.fpu?.builtin ?? null,
    };
  }
}
