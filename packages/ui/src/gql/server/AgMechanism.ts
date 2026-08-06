import { graphql } from './gen';

export const AG_SCIENCE_FOLD_PARK_MUTATION = graphql(`
  mutation agScienceFoldPark {
    agScienceFoldPark {
      result
      msg
    }
  }
`);

export const AG_PICKOFF_MIRROR_PARK_MUTATION = graphql(`
  mutation agPickoffMirrorPark {
    agPickoffMirrorPark {
      result
      msg
    }
  }
`);

export const AG_AO_FOLD_PARK_MUTATION = graphql(`
  mutation agAoFoldPark {
    agAoFoldPark {
      result
      msg
    }
  }
`);

export const AG_ALL_PARK_MUTATION = graphql(`
  mutation agAllPark {
    agAllPark {
      result
      msg
    }
  }
`);
