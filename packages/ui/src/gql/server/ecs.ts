import { graphql } from './gen';

export const ECS_ENABLE_DOME_MUTATION = graphql(`
  mutation EcsEnableDome($mode: DomeMode!) {
    ecsEnableDome(mode: $mode) {
      result
      msg
    }
  }
`);

export const ECS_DISABLE_DOME_MUTATION = graphql(`
  mutation EcsDisableDome {
    ecsDisableDome {
      result
      msg
    }
  }
`);

export const ECS_DOME_PARK_MUTATION = graphql(`
  mutation EcsDomePark {
    ecsDomePark {
      result
      msg
    }
  }
`);

export const ECS_ENABLE_SHUTTERS_MUTATION = graphql(`
  mutation EcsEnableShutters($mode: ShutterModeInput!) {
    ecsEnableShutters(mode: $mode) {
      result
      msg
    }
  }
`);

export const ECS_DISABLE_SHUTTERS_MUTATION = graphql(`
  mutation EcsDisableShutters {
    ecsDisableShutters {
      result
      msg
    }
  }
`);

export const ECS_SHUTTERS_PARK_MUTATION = graphql(`
  mutation EcsShuttersPark {
    ecsShuttersPark {
      result
      msg
    }
  }
`);

export const ECS_MOVE_EAST_VENT_GATE_MUTATION = graphql(`
  mutation EcsMoveEastVentGate($position: IntPercent!) {
    ecsMoveEastVentGate(position: $position) {
      result
      msg
    }
  }
`);

export const ECS_CLOSE_EAST_VENT_GATE_MUTATION = graphql(`
  mutation EcsCloseEastVentGate {
    ecsCloseEastVentGate {
      result
      msg
    }
  }
`);

export const ECS_MOVE_WEST_VENT_GATE_MUTATION = graphql(`
  mutation EcsMoveWestVentGate($position: IntPercent!) {
    ecsMoveWestVentGate(position: $position) {
      result
      msg
    }
  }
`);

export const ECS_CLOSE_WEST_VENT_GATE_MUTATION = graphql(`
  mutation EcsCloseWestVentGate {
    ecsCloseWestVentGate {
      result
      msg
    }
  }
`);
