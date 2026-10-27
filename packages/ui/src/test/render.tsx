import type { MockLink } from '@apollo/client/testing';
import { AtomsAndApollo, type AtomTuples, type InferAtomTuples } from '@gemini-hlsw/lucuma-common-ui/testing';
import { makeCache } from '@gql/ApolloConfigs';
import { GET_SLEW_FLAGS } from '@gql/configs/SlewFlags';
import { SERVER_CONFIGURATION } from '@gql/server/ServerConfiguration';
import type { MockedResponseOf } from '@gql/util';
import { createStore } from 'jotai';
import type { ReactElement } from 'react';
import type { ComponentRenderOptions } from 'vitest-browser-react';
import { render } from 'vitest-browser-react';

import { odbTokenAtom } from '@/components/atoms/auth';
import { longExpirationJwt } from '@/test/helpers';
import type { ServerConfiguration } from '@/types';

import { createServerConfiguration, type OverridePartial } from './create';

interface CreateOptions<T> {
  mocks?: MockLink.MockedResponse[];
  initialValues?: InferAtomTuples<T>;
  serverConfig?: OverridePartial<ServerConfiguration>;
}

export type RenderResultWithStore = Awaited<ReturnType<typeof renderWithContext>>;

/**
 * Renders the UI with the given atoms hydrated and the given Apollo mocks.
 * Mocks answer every time unless they set `maxUsageCount`.
 */
export async function renderWithContext<T extends AtomTuples>(
  ui: ReactElement,
  createOptions: CreateOptions<T> = {},
  options?: ComponentRenderOptions,
) {
  const store = createStore();

  // Add the default atom values to the initial value, if they are not already present
  const initialValues = [
    ...addIfNotPresent(createOptions.initialValues, [odbTokenAtom, longExpirationJwt]),
    ...(createOptions.initialValues ?? []),
  ];

  // Pre-populate the cache with the server configuration
  const cache = makeCache();
  cache.writeQuery({
    query: SERVER_CONFIGURATION,
    data: { serverConfiguration: createServerConfiguration(createOptions.serverConfig) },
  });

  const renderResult = await render(
    <AtomsAndApollo
      store={store}
      initialValues={initialValues}
      cache={cache}
      mocks={[...mocks, ...(createOptions.mocks ?? [])].map((mock) => ({
        ...mock,
        maxUsageCount: mock.maxUsageCount ?? Number.POSITIVE_INFINITY,
      }))}
    >
      {ui}
    </AtomsAndApollo>,
    options,
  );

  return Object.assign(renderResult, {
    store,
    rerender: async (ui: ReactElement) => {
      await renderResult.unmount();
      return renderWithContext(ui, createOptions, options);
    },
  });
}

function addIfNotPresent(tuples: AtomTuples | undefined, atom: AtomTuples[number]): AtomTuples {
  if (tuples?.find(([a]) => a === atom[0])) return [];
  else return [atom];
}

const mocks: MockLink.MockedResponse[] = [
  {
    request: {
      query: GET_SLEW_FLAGS,
      variables: {},
    },
    result: {
      data: {
        slewFlags: {
          __typename: 'SlewFlags',
          pk: 1,
          zeroChopThrow: true,
          zeroSourceOffset: true,
          zeroSourceDiffTrack: true,
          zeroMountOffset: true,
          zeroMountDiffTrack: true,
          shortcircuitTargetFilter: false,
          shortcircuitMountFilter: true,
          resetPointing: true,
          stopGuide: true,
          zeroGuideOffset: false,
          zeroInstrumentOffset: true,
          autoparkPwfs1: false,
          autoparkPwfs2: true,
          autoparkOiwfs: false,
          autoparkGems: true,
          autoparkAowfs: false,
        },
      },
    },
  } satisfies MockedResponseOf<typeof GET_SLEW_FLAGS>,
];
