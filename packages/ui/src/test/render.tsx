/* eslint-disable react-refresh/only-export-components */
import type { MockLink } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing/react';
import { makeCache } from '@gql/ApolloConfigs';
import { GET_SLEW_FLAGS } from '@gql/configs/SlewFlags';
import { SERVER_CONFIGURATION } from '@gql/server/ServerConfiguration';
import type { MockedResponseOf } from '@gql/util';
import type { WritableAtom } from 'jotai';
import { createStore, Provider } from 'jotai';
import { useHydrateAtoms } from 'jotai/utils';
import type { PropsWithChildren, ReactElement } from 'react';
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

function HydrateAtoms<T extends AtomTuples>({
  initialValues,
  children,
}: PropsWithChildren<{ initialValues: InferAtomTuples<T> }>) {
  useHydrateAtoms(initialValues);
  return children;
}

export type RenderResultWithStore = Awaited<ReturnType<typeof renderWithContext>>;

/**
 * Render the given UI with the given atoms hydrated, and sets up ApolloProvider with the given mocks
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
    <Provider store={store}>
      <HydrateAtoms initialValues={initialValues}>
        <MockedProvider
          cache={cache}
          mocks={[...mocks, ...(createOptions.mocks ?? [])]?.map((m) => ({
            ...m,
            maxUsageCount: m.maxUsageCount ?? Infinity,
          }))}
        >
          {ui}
        </MockedProvider>
      </HydrateAtoms>
    </Provider>,
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

// Some typescript magic here 🧙
// Basically it allows the `initialValues` array to be type-safe with its values
// Copied from an internal Jotai type

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyWritableAtom = WritableAtom<unknown, any[], unknown>;

type AtomTuples = (readonly [AnyWritableAtom, ...unknown[]])[];

type InferAtomTuples<T> = {
  [K in keyof T]: T[K] extends readonly [infer A, ...infer Rest]
    ? A extends WritableAtom<unknown, infer Args, unknown>
      ? Rest extends Args
        ? readonly [A, ...Rest]
        : never
      : T[K]
    : never;
};
