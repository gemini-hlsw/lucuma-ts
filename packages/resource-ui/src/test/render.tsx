import type { MockLink } from '@apollo/client/testing';
import { AtomsAndApollo, type AtomTuples, type InferAtomTuples } from '@gemini-hlsw/lucuma-common-ui/testing';
import { createStore, type Store } from 'jotai';
import { PrimeReactProvider } from 'primereact/api';
import { type JSX, type ReactElement, useEffect } from 'react';
import {
  createRoutesStub,
  type Location,
  type NavigationType,
  Outlet,
  useLocation,
  useNavigate,
  useNavigationType,
} from 'react-router';
import type { ComponentRenderOptions, RenderResult } from 'vitest-browser-react';
import { render } from 'vitest-browser-react';

import Layout from '@/components/layout/Layout';

export interface RenderWithContextOptions<T> {
  /** Each operation answered once from a typed response built in `test/fixtures/`. */
  readonly mocks?: readonly MockLink.MockedResponse[];
  /** Atoms set before the first paint; sign in with `[odbTokenAtom, token]`. */
  readonly initialValues?: InferAtomTuples<T>;
  /** Pass one to share a store between renders; otherwise each render gets its own. */
  readonly store?: Store;
}

export interface RenderResultWithStore extends RenderResult {
  readonly store: Store;
}

export async function renderWithContext<T extends AtomTuples>(
  ui: ReactElement,
  { mocks = [], initialValues, store = createStore() }: RenderWithContextOptions<T> = {},
  options?: ComponentRenderOptions,
): Promise<RenderResultWithStore> {
  const result = await render(
    <PrimeReactProvider>
      <AtomsAndApollo store={store} mocks={mocks} {...(initialValues ? { initialValues } : {})}>
        {ui}
      </AtomsAndApollo>
    </PrimeReactProvider>,
    options,
  );
  return Object.assign(result, { store });
}

export interface StubRoute {
  readonly path: string;
  readonly element: ReactElement;
}

export interface RenderWithRouteOptions<T> extends RenderWithContextOptions<T> {
  /** Initial URL including query string, e.g. "/night?site=GN&night=2026-08-01". */
  readonly route: string;
  /** The route pattern, when it differs from the URL. Defaults to the URL's path. */
  readonly path?: string;
  /** Extra routes to register so navigation targets resolve. */
  readonly extraRoutes?: readonly StubRoute[];
  /** Child routes for the subject's `<Outlet />`, to mount the real shell around a page. */
  readonly childRoutes?: readonly StubRoute[];
}

/** What the stub's router reports, read through its hooks: the stub keeps the router itself private. */
export interface RouterReadout {
  readonly location: Location;
  readonly navigationType: NavigationType;
  navigate(delta: number): void | Promise<void>;
}

export interface RenderResultWithRoute extends RenderResultWithStore {
  readonly router: RouterReadout;
}

export async function renderWithRoute<T extends AtomTuples>(
  ui: ReactElement,
  { route, path: pattern, extraRoutes = [], childRoutes, ...context }: RenderWithRouteOptions<T>,
  options?: ComponentRenderOptions,
): Promise<RenderResultWithRoute> {
  const path = pattern ?? route.split('?')[0] ?? '/';
  let current: RouterReadout | undefined;
  const router: RouterReadout = {
    get location() {
      return readout().location;
    },
    get navigationType() {
      return readout().navigationType;
    },
    navigate: (delta) => readout().navigate(delta),
  };
  function readout(): RouterReadout {
    if (current === undefined) throw new Error('The route stub has not mounted yet.');
    return current;
  }
  function Tap(): JSX.Element {
    const location = useLocation();
    const navigationType = useNavigationType();
    const navigate = useNavigate();
    useEffect(() => {
      current = { location, navigationType, navigate };
    });
    return <Outlet />;
  }

  const collision = extraRoutes.find((extra) => extra.path === path);
  if (collision) throw new Error(`extraRoutes registers "${collision.path}", the subject's own path.`);

  const asStub = ({ path: stubPath, element }: StubRoute) => ({ path: stubPath, Component: () => element });
  const Stub = createRoutesStub([
    {
      Component: Tap,
      children: [
        {
          path,
          Component: () => ui,
          ...(childRoutes === undefined ? {} : { children: childRoutes.map(asStub) }),
        },
        ...extraRoutes.map(asStub),
      ],
    },
  ]);

  const result = await renderWithContext(<Stub initialEntries={[route]} />, context, options);
  return Object.assign(result, { router });
}

export interface RenderInShellOptions<T> extends Omit<RenderWithRouteOptions<T>, 'path' | 'childRoutes'> {
  /** What mounts at `/` around the page; `<Layout />` unless the test wraps the shell itself. */
  readonly shell?: ReactElement;
}

/** `ui` as the page under the real shell, at the route's own path. */
export async function renderInShell<T extends AtomTuples>(
  ui: ReactElement,
  { shell = <Layout />, ...options }: RenderInShellOptions<T>,
  renderOptions?: ComponentRenderOptions,
): Promise<RenderResultWithRoute> {
  const path = (options.route.split('?')[0] ?? '/').replace(/^\//u, '');
  return renderWithRoute(shell, { ...options, path: '/', childRoutes: [{ path, element: ui }] }, renderOptions);
}
