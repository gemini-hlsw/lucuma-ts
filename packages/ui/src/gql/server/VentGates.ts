import { graphql } from './gen';

export const ECS_CLOSE_EAST_VENT_GATE_MUTATION = graphql(`
  mutation ecsCloseEastVentGate {
    ecsCloseEastVentGate {
      result
      msg
    }
  }
`);

export const ECS_CLOSE_WEST_VENT_GATE_MUTATION = graphql(`
  mutation ecsCloseWestVentGate {
    ecsCloseWestVentGate {
      result
      msg
    }
  }
`);
