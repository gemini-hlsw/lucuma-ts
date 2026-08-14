import { graphql } from './gen';

// MCS
export const MOUNT_FOLLOW_MUTATION = graphql(`
  mutation ChangeMountState($enable: Boolean!) {
    mountFollow(enable: $enable) {
      result
      msg
    }
  }
`);

// CRCS
export const ROTATOR_FOLLOW_MUTATION = graphql(`
  mutation ChangeRotatorState($enable: Boolean!) {
    rotatorFollow(enable: $enable) {
      result
      msg
    }
  }
`);

// SCS
export const SCS_FOLLOW_MUTATION = graphql(`
  mutation ChangeScsState($enable: Boolean!) {
    scsFollow(enable: $enable) {
      result
      msg
    }
  }
`);

// OIWFS
export const OIWFS_FOLLOW_MUTATION = graphql(`
  mutation ChangeOiwfsState($enable: Boolean!) {
    oiwfsFollow(enable: $enable) {
      result
      msg
    }
  }
`);

export const PWFS1_FOLLOW_MUTATION = graphql(`
  mutation ChangePwfs1State($enable: Boolean!) {
    pwfs1Follow(enable: $enable) {
      result
      msg
    }
  }
`);

export const PWFS2_FOLLOW_MUTATION = graphql(`
  mutation ChangePwfs2State($enable: Boolean!) {
    pwfs2Follow(enable: $enable) {
      result
      msg
    }
  }
`);
