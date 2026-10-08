/* eslint-disable react-refresh/only-export-components */
import type { MockLink } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing/react';
import type { WritableAtom } from 'jotai';
import { createStore, Provider } from 'jotai';
import { useHydrateAtoms } from 'jotai/utils';
import type { Store } from 'jotai/vanilla/store';
import { PrimeReactProvider } from 'primereact/api';
import type { PropsWithChildren, ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { render } from 'vitest-browser-react';

import { sessionCheckedAtom, setToken, signedOutElsewhereAtom } from '@/components/atoms/auth';
import { buildCache } from '@/gql/cache';

interface Route {
  readonly path: string;
  readonly element: ReactElement;
}

interface RenderOptions<T> {
  /** Initial URL including query string, e.g. "/night?site=GN&night=2026-08-01". */
  readonly route?: string;
  /** The route pattern, when it differs from the URL. Defaults to the URL's path. */
  readonly path?: string;
  /** Extra routes to register so navigation targets resolve. */
  readonly extraRoutes?: readonly Route[];
  /** Child routes for `ui`'s `<Outlet />`, to mount the real shell around a page. */
  readonly childRoutes?: readonly Route[];
  /** Each operation answered from a typed response built in `test/fixtures/`. */
  readonly mocks?: readonly MockLink.MockedResponse[];
  readonly initialValues?: InferAtomTuples<T>;
  readonly token?: string | null;
  readonly sessionChecked?: boolean;
  /** The module store, for a tree that `signOut` or the session keeper must reach. */
  readonly store?: Store;
}

/** The router comes back too: a memory router keeps its own history, and window.history would not. */
export type RenderResultWithStore = Awaited<ReturnType<typeof renderWithContext>>;

function HydrateAtoms<T extends AtomTuples>({
  initialValues,
  children,
}: PropsWithChildren<{ initialValues: InferAtomTuples<T> }>) {
  useHydrateAtoms(initialValues);
  return children;
}

export async function renderWithContext<T extends AtomTuples>(ui: ReactElement, options: RenderOptions<T> = {}) {
  const { route = '/', extraRoutes = [], childRoutes, mocks = [], token = null, sessionChecked = true } = options;
  const path = options.path ?? route.split('?')[0] ?? '/';
  const root = childRoutes === undefined ? { path, element: ui } : { path, element: ui, children: [...childRoutes] };
  const router = createMemoryRouter([root, ...extraRoutes.filter((extra) => extra.path !== path)], {
    initialEntries: [route],
  });

  const store = options.store ?? createStore();
  // The token atom writes sessionStorage, which a test may deny, so `setToken` sets it outside React and swallows the refusal.
  setToken(store, token);
  const given: AtomTuples = options.initialValues ?? [];
  const defaults: AtomTuples = [
    [sessionCheckedAtom, sessionChecked],
    [signedOutElsewhereAtom, false],
  ];
  const initialValues = [...defaults.filter(([atom]) => !given.some(([chosen]) => chosen === atom)), ...given];
  // `useHydrateAtoms` hydrates an atom once per store, so a store that outlives this render is set directly.
  const hydrate = options.store === undefined;
  if (!hydrate) for (const [atom, ...args] of initialValues) store.set(atom, ...args);

  const cache = buildCache();

  const result = await render(
    <PrimeReactProvider>
      <Provider store={store}>
        <HydrateAtoms initialValues={hydrate ? initialValues : []}>
          <MockedProvider
            cache={cache}
            mocks={mocks.map((mock) => ({ ...mock, maxUsageCount: mock.maxUsageCount ?? Infinity }))}
          >
            <RouterProvider router={router} />
          </MockedProvider>
        </HydrateAtoms>
      </Provider>
    </PrimeReactProvider>,
  );
  return Object.assign(result, { router, store });
}

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
