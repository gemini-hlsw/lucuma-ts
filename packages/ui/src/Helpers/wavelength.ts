import type { GetCentralWavelengthQuery } from '@gql/odb/gen/graphql';

import type { Fpu, Visitor } from '@/types';

export function extractCentralWavelength(
  data: GetCentralWavelengthQuery | undefined,
  visitor: Visitor | undefined | null,
): { wavelength: number | undefined; fpu: Fpu | null | undefined } {
  if (visitor) {
    return {
      wavelength: visitor.centralWavelength.nanometers,
      fpu: null,
    };
  }

  const config = data?.executionConfig;
  if (!config) return { wavelength: undefined, fpu: undefined };

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
    case 'GNIRS':
      instrumentName = 'gnirs';
      break;
    default:
      console.warn(`Unknown instrument ${config.instrument}`);
      return { wavelength: undefined, fpu: undefined };
  }

  const instrumentConfig = config[instrumentName];
  const acqusitionStep =
    instrumentConfig && 'acquisition' in instrumentConfig
      ? instrumentConfig?.acquisition?.nextAtom.steps[0]?.instrumentConfig
      : undefined;
  const scienceStep = instrumentConfig?.science?.nextAtom.steps[0]?.instrumentConfig;
  const step = acqusitionStep ?? scienceStep;

  return {
    wavelength: step?.centralWavelength?.nanometers,
    fpu: step && 'fpu' in step ? (step.fpu?.builtin ?? null) : null,
  };
}
