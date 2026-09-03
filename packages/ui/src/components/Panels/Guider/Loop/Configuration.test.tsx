import { GET_CONFIGURATION } from '@gql/configs/Configuration';
import { GET_GUIDE_LOOP, UPDATE_GUIDE_LOOP } from '@gql/configs/GuideLoop';
import type { MockedResponseOf } from '@gql/util';

import { createConfiguration, createGuideLoop } from '@/test/create';
import { renderWithContext } from '@/test/render';
import type { GuideLoop } from '@/types';

import { Configuration } from './Configuration';

describe(Configuration, () => {
  describe('m2ComaNotAllowed — M2 Coma checkbox disabled state', () => {
    it.each([
      // source is 'OIWFS' -> always disabled
      ['GMOS_OIWFS', 'GN'],
      ['FLAMINGOS2_OIWFS', 'GS'],
      ['GMOS_OIWFS,PWFS1', 'GN'],
      // exactly 'PWFS2' -> always disabled
      ['PWFS2', 'GN'],
      ['PWFS2', 'GS'],
      // exactly 'PWFS1' at GN -> disabled
      ['PWFS1', 'GN'],
      // multiple non-OIWFS sources -> one of them PWFS1 at GN -> not allowed
      ['PWFS1,PWFS2', 'GN'],
    ] as const)('source=%s site=%s -> disabled', async (source, site) => {
      const sut = await renderWithContext(<Configuration />, {
        mocks: [guideLoopMock(source), configurationMock],
        serverConfig: { site },
      });

      await expect.element(sut.getByRole('checkbox', { name: 'M2 Coma' })).toBeDisabled();
    });

    it.each([
      // exactly 'PWFS1' at GS -> allowed
      ['PWFS1', 'GS'],
    ] as const)('source=%s site=%s -> enabled', async (source, site) => {
      const sut = await renderWithContext(<Configuration />, {
        mocks: [guideLoopMock(source), configurationMock],
        serverConfig: { site },
      });

      await expect.element(sut.getByRole('checkbox', { name: 'M2 Coma' })).toBeEnabled();
    });
  });

  it('auto-disables m2ComaEnable when m2ComaNotAllowed becomes true', async () => {
    const updateMock = makeUpdateGuideLoopMock();
    await renderWithContext(<Configuration />, {
      // m2TipTiltSource=OIWFS -> m2ComaNotAllowed=true, m2ComaEnable=true -> effect fires
      mocks: [guideLoopMock('OIWFS', true), configurationMock, updateMock],
    });

    await expect.poll(() => updateMock.request.variables).toHaveBeenCalledWith({ pk: 1, m2ComaEnable: false });
  });
});

function guideLoopMock(m2TipTiltSource: string, m2ComaEnable = false) {
  return {
    request: {
      query: GET_GUIDE_LOOP,
      variables: () => true,
    },
    result: {
      data: {
        guideLoop: createGuideLoop({ m2TipTiltSource, m2ComaEnable }),
      },
    },
  } satisfies MockedResponseOf<typeof GET_GUIDE_LOOP>;
}

const configurationMock = {
  request: {
    query: GET_CONFIGURATION,
    variables: {},
  },
  result: {
    data: {
      configuration: createConfiguration(),
    },
  },
} satisfies MockedResponseOf<typeof GET_CONFIGURATION>;

function makeUpdateGuideLoopMock() {
  return {
    request: {
      query: UPDATE_GUIDE_LOOP,
      variables: vi.fn().mockReturnValue(true),
    },
    result: (arg) => ({
      data: {
        updateGuideLoop: {
          ...createGuideLoop(),
          ...arg,
        } as GuideLoop,
      },
    }),
  } satisfies MockedResponseOf<typeof UPDATE_GUIDE_LOOP>;
}
