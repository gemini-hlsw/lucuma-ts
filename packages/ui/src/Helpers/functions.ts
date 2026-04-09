import { isNotNullish } from '@gemini-hlsw/lucuma-common-ui';
import type { Configuration, WfsType } from '@gql/configs/gen/graphql';
import type { GuideProbe, Instrument } from '@gql/server/gen/graphql';

export function getConfigWfs(configuration: Configuration | undefined | null): WfsType {
  const { selectedGuiderTarget, selectedOiTarget, selectedP1Target, selectedP2Target } = configuration ?? {};

  if (isNotNullish(selectedOiTarget) && selectedGuiderTarget === selectedOiTarget) return 'OIWFS';
  if (isNotNullish(selectedP1Target) && selectedGuiderTarget === selectedP1Target) return 'PWFS1';
  if (isNotNullish(selectedP2Target) && selectedGuiderTarget === selectedP2Target) return 'PWFS2';
  else return 'NONE';
}

/**
 * Convert instrument to OIWFS name.
 * TODO: Add other instruments when odb supports them.
 */
export function instrumentToOiwfs(instrument: Instrument | null | undefined): GuideProbe | undefined {
  switch (instrument) {
    case 'GMOS_NORTH':
    case 'GMOS_SOUTH':
      return 'GMOS_OIWFS';
    case 'FLAMINGOS2':
      return 'FLAMINGOS2_OIWFS';
    case 'IGRINS2':
      return 'PWFS2';
    default:
      return undefined;
  }
}
