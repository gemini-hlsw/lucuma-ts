import { graphql } from './gen';

export const ECS_ENABLE_DOME_MUTATION = graphql(`
  mutation ecsEnableDome($mode: DomeMode!) {
    ecsEnableDome(mode: $mode) {
      result
      msg
    }
  }
`);

export const ECS_DISABLE_DOME_MUTATION = graphql(`
  mutation ecsDisableDome {
    ecsDisableDome {
      result
      msg
    }
  }
`);

export const ECS_DOME_PARK_MUTATION = graphql(`
  mutation ecsDomePark {
    ecsDomePark {
      result
      msg
    }
  }
`);

export const ECS_ENABLE_SHUTTERS_MUTATION = graphql(`
  mutation ecsEnableShutters($mode: ShutterModeInput!) {
    ecsEnableShutters(mode: $mode) {
      result
      msg
    }
  }
`);

export const ECS_DISABLE_SHUTTERS_MUTATION = graphql(`
  mutation ecsDisableShutters {
    ecsDisableShutters {
      result
      msg
    }
  }
`);

export const ECS_SHUTTERS_PARK_MUTATION = graphql(`
  mutation ecsShuttersPark {
    ecsShuttersPark {
      result
      msg
    }
  }
`);

export const ECS_MOVE_EAST_VENT_GATE_MUTATION = graphql(`
  mutation ecsMoveEastVentGate($position: IntPercent!) {
    ecsMoveEastVentGate(position: $position) {
      result
      msg
    }
  }
`);

export const ECS_CLOSE_EAST_VENT_GATE_MUTATION = graphql(`
  mutation ecsCloseEastVentGate {
    ecsCloseEastVentGate {
      result
      msg
    }
  }
`);

export const ECS_MOVE_WEST_VENT_GATE_MUTATION = graphql(`
  mutation ecsMoveWestVentGate($position: IntPercent!) {
    ecsMoveWestVentGate(position: $position) {
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
