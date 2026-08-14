import { graphql } from './gen';

export const SLEW_MUTATION = graphql(`
  mutation RunSlew($slewOptions: SlewOptionsInput!, $config: TcsConfigInput!, $obsId: ObservationId) {
    slew(slewOptions: $slewOptions, config: $config, obsId: $obsId) {
      result
    }
  }
`);
