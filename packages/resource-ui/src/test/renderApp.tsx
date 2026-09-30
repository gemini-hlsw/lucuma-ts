import { ApolloProvider } from '@apollo/client/react';
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
  mock: MockApollo;
  router: ReturnType<typeof createMemoryRouter>;
  store: typeof store;
};

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
  mock?: MockApollo;
  token?: string | null;
  sessionChecked?: boolean;
}

export async function renderApp({
  element,
  route,
  path: pattern,
  extraRoutes = [],
  childRoutes,
  mock = createMockApollo(),
  token = null,
  sessionChecked = true,
}: RenderOptions): Promise<RenderedApp> {
  const path = pattern ?? route.split('?')[0] ?? '/';
  const root = childRoutes === undefined ? { path, element } : { path, element, children: [...childRoutes] };
  const router = createMemoryRouter([root, ...extraRoutes.filter((extra) => extra.path !== path)], {
    initialEntries: [route],
  });
  setToken(store, token);
  store.set(sessionCheckedAtom, sessionChecked);

  const result = await render(
    <PrimeReactProvider>
      <JotaiProvider store={store}>
        <ApolloProvider client={mock.client}>
          <RouterProvider router={router} />
        </ApolloProvider>
      </JotaiProvider>
    </PrimeReactProvider>,
  );
  return Object.assign(result, { mock, router, store });
}
