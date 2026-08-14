import { graphql } from './gen';

export const MOUNT_PARK_MUTATION = graphql(`
  mutation MountPark {
    mountPark {
      result
      msg
    }
  }
`);

export const ROTATOR_PARK_MUTATION = graphql(`
  mutation RotatorPark {
    rotatorPark {
      result
      msg
    }
  }
`);

export const OIWFS_PARK_MUTATION = graphql(`
  mutation OiwfsPark {
    oiwfsPark {
      result
      msg
    }
  }
`);

export const PWFS1_PARK_MUTATION = graphql(`
  mutation Pwfs1Park {
    pwfs1Park {
      result
      msg
    }
  }
`);

export const PWFS2_PARK_MUTATION = graphql(`
  mutation Pwfs2Park {
    pwfs2Park {
      result
      msg
    }
  }
`);

export const MOUNT_UNWRAP_MUTATION = graphql(`
  mutation MountUnwrap {
    mountUnwrap {
      result
      msg
    }
  }
`);

export const ROTATOR_UNWRAP_MUTATION = graphql(`
  mutation RotatorUnwrap {
    rotatorUnwrap {
      result
      msg
    }
  }
`);

export const PWFS1_UNWRAP_MUTATION = graphql(`
  mutation Pwfs1Unwrap {
    pwfs1Unwrap {
      result
      msg
    }
  }
`);

export const PWFS2_UNWRAP_MUTATION = graphql(`
  mutation Pwfs2Unwrap {
    pwfs2Unwrap {
      result
      msg
    }
  }
`);
