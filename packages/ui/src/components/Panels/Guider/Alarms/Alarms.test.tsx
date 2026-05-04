import type { MockLink } from '@apollo/client/testing';
import type { WfsItemFragment } from '@gql/configs/gen/graphql';
import { GET_GUIDE_ALARMS, UPDATE_GUIDE_ALARM } from '@gql/configs/GuideAlarm';
import { GUIDE_QUALITY_QUERY, GUIDE_QUALITY_SUBSCRIPTION } from '@gql/server/GuideQuality';
import { GUIDE_STATE_QUERY, GUIDE_STATE_SUBSCRIPTION } from '@gql/server/GuideState';
import type { MockedResponseOf } from '@gql/util';
import type { Store } from 'jotai/vanilla/store';
import { page, userEvent } from 'vitest/browser';

import { guideAlarmSoundAtom } from '@/components/atoms/alarm';
import { createGuideAlarm, createGuideQuality, createGuideState } from '@/test/create';
import { renderWithContext } from '@/test/render';

import { Alarms } from './Alarms';

describe(Alarms.name, () => {
  let store: Store;
  beforeEach(async () => {
    store = (await renderWithContext(<Alarms />, { mocks })).store;

    // Wait for the alarms to be loaded
    await expect.element(page.getByText('PWFS1')).toBeEnabled();
  });

  it('should render 3 alarms', async () => {
    await expect.element(page.getByText('PWFS1')).toBeInTheDocument();
    await expect.element(page.getByText('PWFS2')).toBeInTheDocument();
    await expect.element(page.getByText('OIWFS')).toBeInTheDocument();
  });

  it('calls updateAlarm when limit is changed', async () => {
    const limitInput = page.getByTestId('limit-PWFS1');

    await userEvent.fill(limitInput, '900');

    await expect.element(page.getByTestId('limit-PWFS1')).toHaveValue('900');
    expect(store.get(guideAlarmSoundAtom)).toEqual('SUBAPERTURES_BAD');
  });
});

const mocks: MockLink.MockedResponse[] = [
  {
    request: {
      query: GET_GUIDE_ALARMS,
      variables: {},
    },
    result: {
      data: {
        guideAlarms: {
          OIWFS: createGuideAlarm({
            wfs: 'OIWFS',
            limit: 1000,
            enabled: true,
          }),
          PWFS1: createGuideAlarm({
            wfs: 'PWFS1',
            limit: 1001,
            enabled: false,
          }),
          PWFS2: createGuideAlarm({
            wfs: 'PWFS2',
            limit: 1002,
            enabled: false,
          }),
          __typename: 'GuideAlarms',
        },
      },
    },
  } satisfies MockedResponseOf<typeof GET_GUIDE_ALARMS>,
  {
    request: {
      query: GUIDE_QUALITY_QUERY,
      variables: {},
    },
    result: {
      data: {
        guidersQualityValues: {
          oiwfs: createGuideQuality({
            flux: 1001,
          }),
          pwfs1: createGuideQuality({
            flux: 1002,
          }),
          pwfs2: createGuideQuality({
            flux: 1003,
          }),
          __typename: 'GuidersQualityValues',
        },
      },
    },
  } satisfies MockedResponseOf<typeof GUIDE_QUALITY_QUERY>,
  {
    request: {
      query: GUIDE_QUALITY_SUBSCRIPTION,
      variables: {},
    },
    maxUsageCount: Infinity,
    result: {
      data: {
        guidersQualityValues: {
          oiwfs: createGuideQuality({
            flux: 1001,
          }),
          pwfs1: createGuideQuality({
            flux: 1002,
          }),
          pwfs2: createGuideQuality({
            flux: 1003,
          }),
          __typename: 'GuidersQualityValues',
        },
      },
    },
  } satisfies MockedResponseOf<typeof GUIDE_QUALITY_SUBSCRIPTION>,
  {
    request: {
      query: UPDATE_GUIDE_ALARM,
      variables: { wfs: 'PWFS1', limit: 1000 },
    },
    result: (arg) => ({
      data: {
        updateGuideAlarm: createGuideAlarm({
          wfs: 'PWFS1',
          ...(arg as Partial<WfsItemFragment>),
        }),
      },
    }),
  } satisfies MockedResponseOf<typeof UPDATE_GUIDE_ALARM>,
  {
    request: {
      query: GUIDE_STATE_QUERY,
      variables: {},
    },
    result: {
      data: {
        guideState: createGuideState(),
      },
    },
  } satisfies MockedResponseOf<typeof GUIDE_STATE_QUERY>,
  {
    request: {
      query: GUIDE_STATE_SUBSCRIPTION,
      variables: {},
    },
    maxUsageCount: Infinity,
    result: {
      data: {
        guideState: createGuideState(),
      },
    },
  } satisfies MockedResponseOf<typeof GUIDE_STATE_SUBSCRIPTION>,
];
