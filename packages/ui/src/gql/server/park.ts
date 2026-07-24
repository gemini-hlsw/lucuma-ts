import { graphql } from './gen';

export const MOUNT_PARK_MUTATION = graphql(`
  mutation mountPark {
    mountPark {
      result
      msg
    }
  }
`);

export const ROTATOR_PARK_MUTATION = graphql(`
  mutation rotatorPark {
    rotatorPark {
      result
      msg
    }
  }
`);

export const OIWFS_PARK_MUTATION = graphql(`
  mutation oiwfsPark {
    oiwfsPark {
      result
      msg
    }
  }
`);

export const PWFS1_PARK_MUTATION = graphql(`
  mutation pwfs1Park {
    pwfs1Park {
      result
      msg
    }
  }
`);

export const PWFS2_PARK_MUTATION = graphql(`
  mutation pwfs2Park {
    pwfs2Park {
      result
      msg
    }
  }
`);

export const MOUNT_UNWRAP_MUTATION = graphql(`
  mutation mountUnwrap {
    mountUnwrap {
      result
      msg
    }
  }
`);

export const ROTATOR_UNWRAP_MUTATION = graphql(`
  mutation rotatorUnwrap {
    rotatorUnwrap {
      result
      msg
    }
  }
`);

export const PWFS1_UNWRAP_MUTATION = graphql(`
  mutation pwfs1Unwrap {
    pwfs1Unwrap {
      result
      msg
    }
  }
`);

export const PWFS2_UNWRAP_MUTATION = graphql(`
  mutation pwfs2Unwrap {
    pwfs2Unwrap {
      result
      msg
    }
  }
`);
