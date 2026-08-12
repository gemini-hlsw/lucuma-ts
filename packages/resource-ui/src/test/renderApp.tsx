/**
 * Test render helper: mounts UI inside a mock-backed Apollo provider and a memory
 * router, so browser tests exercise the real resolvers over a fresh in-memory store.
 */
import { ApolloProvider } from '@apollo/client/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { render } from 'vitest-browser-react';

import { createMockApollo, type MockApollo } from './mockClient';

export type RenderedApp = Awaited<ReturnType<typeof render>> & { mock: MockApollo };

interface RenderOptions {
  /** Route element to mount at the initial path. */
  element: ReactElement;
  /** Initial URL including query string, e.g. "/night?site=GN&night=2026-08-01". */
  route: string;
  /**
   * The route *pattern* to register, when it differs from the URL - the public
   * pages take their selection from path parameters, so they need e.g.
   * "/schedule/:site/:semester" registered for the URL "/schedule/GN/2026B".
   * Defaults to the URL's path, which is right for query-string pages.
   */
  path?: string;
  /** Extra routes to register so navigation targets resolve. */
  extraRoutes?: readonly { path: string; element: ReactElement }[];
  /**
   * Child routes rendered inside `element`'s `<Outlet />`. Use this to mount the
   * real shell (Layout) around pages, so a test can navigate it the way the
   * application does rather than asserting on one page in isolation.
   */
  childRoutes?: readonly { path: string; element: ReactElement }[];
  mock?: MockApollo;
}

/** Renders a page with the mock Apollo client and a router seeded at `route`. */
export async function renderApp({
  element,
  route,
  path: pattern,
  extraRoutes = [],
  childRoutes,
  mock = createMockApollo(),
}: RenderOptions): Promise<RenderedApp> {
  const path = pattern ?? route.split('?')[0] ?? '/';
  const root = childRoutes === undefined ? { path, element } : { path, element, children: [...childRoutes] };
  const router = createMemoryRouter([root, ...extraRoutes.filter((extra) => extra.path !== path)], {
    initialEntries: [route],
  });

  const result = await render(
    <ApolloProvider client={mock.client}>
      <RouterProvider router={router} />
    </ApolloProvider>,
  );
  return Object.assign(result, { mock });
}
