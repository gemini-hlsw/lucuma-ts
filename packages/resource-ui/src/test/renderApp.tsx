import { ApolloProvider } from '@apollo/client/react';
import type { MockLink } from '@apollo/client/testing';
import { AtomsAndApollo } from '@gemini-hlsw/lucuma-common-ui/testing';
import { Provider as JotaiProvider } from 'jotai';
import { PrimeReactProvider } from 'primereact/api';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { render } from 'vitest-browser-react';

import { sessionCheckedAtom, setToken } from '@/components/atoms/auth';
import { store } from '@/components/atoms/store';

import { createMockApollo, type MockApollo } from './mockClient';

/** The router comes back too: a memory router keeps its own history, and window.history would not. */
export type RenderedApp = Awaited<ReturnType<typeof render>> & {
  router: ReturnType<typeof createMemoryRouter>;
  store: typeof store;
};

/** Each operation answered from a typed response built in `test/fixtures/`. */
interface Fixtures {
  mocks: readonly MockLink.MockedResponse[];
  mock?: never;
}

/** The in-repo mock schema, the default until every test passes `mocks`. */
interface MockSchema {
  mock?: MockApollo;
  mocks?: never;
}

interface RenderOptions {
  element: ReactElement;
  /** Initial URL including query string, e.g. "/night?site=GN&night=2026-08-01". */
  route: string;
  /** The route pattern, when it differs from the URL. Defaults to the URL's path. */
  path?: string;
  /** Extra routes to register so navigation targets resolve. */
  extraRoutes?: readonly { path: string; element: ReactElement }[];
  /** Child routes for `element`'s `<Outlet />`, to mount the real shell around a page. */
  childRoutes?: readonly { path: string; element: ReactElement }[];
  token?: string | null;
  sessionChecked?: boolean;
}

export function renderApp(options: RenderOptions & Fixtures): Promise<RenderedApp>;
export function renderApp(options: RenderOptions & MockSchema): Promise<RenderedApp & { mock: MockApollo }>;

export async function renderApp({
  element,
  route,
  path: pattern,
  extraRoutes = [],
  childRoutes,
  mocks,
  mock = mocks === undefined ? createMockApollo() : undefined,
  token = null,
  sessionChecked = true,
}: RenderOptions & (Fixtures | MockSchema)): Promise<RenderedApp & { mock: MockApollo | undefined }> {
  const path = pattern ?? route.split('?')[0] ?? '/';
  const root = childRoutes === undefined ? { path, element } : { path, element, children: [...childRoutes] };
  const router = createMemoryRouter([root, ...extraRoutes.filter((extra) => extra.path !== path)], {
    initialEntries: [route],
  });
  setToken(store, token);
  store.set(sessionCheckedAtom, sessionChecked);

  const result = await render(
    <PrimeReactProvider>
      {mock === undefined ? (
        <AtomsAndApollo store={store} mocks={mocks}>
          <RouterProvider router={router} />
        </AtomsAndApollo>
      ) : (
        <JotaiProvider store={store}>
          <ApolloProvider client={mock.client}>
            <RouterProvider router={router} />
          </ApolloProvider>
        </JotaiProvider>
      )}
    </PrimeReactProvider>,
  );
  return Object.assign(result, { mock, router, store });
}
