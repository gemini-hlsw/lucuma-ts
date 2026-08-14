import type { QueryAndSubscriptionOptions } from '../use-query-and-subscription';
import { useQueryAndSubscription } from '../use-query-and-subscription';
import { graphql } from './gen';

export const MECH_SYSTEM_STATE_FRAGMENT = graphql(`
  fragment MechSystemStateItem on MechSystemState {
    parked
    follow
  }
`);

export const DISTANCE_FRAGMENT = graphql(`
  fragment DistanceItem on Distance {
    meters
  }
`);

export const SHUTTER_MODE_FRAGMENT = graphql(`
  fragment ShutterModeItem on ShutterMode {
    mode
    aperture {
      ...DistanceItem
    }
  }
`);

export const ENCLOSURE_STATE_FRAGMENT = graphql(`
  fragment EnclosureStateItem on EnclosureState {
    domeEnabled
    domeMode
    shuttersEnabled
    shuttersMode {
      ...ShutterModeItem
    }
    eastVentGateAperture
    westVentGateAperture
  }
`);

export const TELESCOPE_STATE_FRAGMENT = graphql(`
  fragment TelescopeStateItem on TelescopeState {
    mount {
      ...MechSystemStateItem
    }
    scs {
      ...MechSystemStateItem
    }
    crcs {
      ...MechSystemStateItem
    }
    pwfs1 {
      ...MechSystemStateItem
    }
    pwfs2 {
      ...MechSystemStateItem
    }
    oiwfs {
      ...MechSystemStateItem
    }
    enclosure {
      ...EnclosureStateItem
    }
  }
`);

export const GET_TELESCOPE_STATE = graphql(`
  query TelescopeState {
    telescopeState {
      ...TelescopeStateItem
    }
  }
`);

export const TELESCOPE_STATE_SUBSCRIPTION = graphql(`
  subscription TelescopeStates {
    telescopeState {
      ...TelescopeStateItem
    }
  }
`);

export function useTelescopeState(options?: QueryAndSubscriptionOptions) {
  return useQueryAndSubscription(GET_TELESCOPE_STATE, TELESCOPE_STATE_SUBSCRIPTION, 'telescopeState', options);
}
