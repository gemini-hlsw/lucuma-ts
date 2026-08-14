import { graphql } from './gen';

export const AG_SCIENCE_FOLD_PARK_MUTATION = graphql(`
  mutation AgScienceFoldPark {
    agScienceFoldPark {
      result
      msg
    }
  }
`);

export const AG_PICKOFF_MIRROR_PARK_MUTATION = graphql(`
  mutation AgPickoffMirrorPark {
    agPickoffMirrorPark {
      result
      msg
    }
  }
`);

export const AG_AO_FOLD_PARK_MUTATION = graphql(`
  mutation AgAoFoldPark {
    agAoFoldPark {
      result
      msg
    }
  }
`);

export const AG_ALL_PARK_MUTATION = graphql(`
  mutation AgAllPark {
    agAllPark {
      result
      msg
    }
  }
`);
