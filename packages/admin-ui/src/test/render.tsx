import type { MockLink } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing/react';
import { createStore, Provider as JotaiProvider } from 'jotai';
import { PrimeReactProvider } from 'primereact/api';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { render } from 'vitest-browser-react';

import { odbTokenAtom } from '@/components/atoms/auth';
import { ToastProvider } from '@/components/toast';

// The typed-mock helper is shared from common-ui; re-exported so tests can keep
// importing it alongside renderWithContext from this module.
export type { MockedResponseOf } from '@gemini-hlsw/lucuma-common-ui/testing';

/**
 * Shared render helper (the common-ui renderWithContext shape, with the
 * providers this app needs): Apollo (mocked), Jotai with a per-test store,
 * PrimeReact, toasts, and a memory router. Pass GraphQL `mocks` to drive
 * Apollo-backed components and `token` to render as a signed-in user (build
 * one with test/factories.ts's fakeJwt).
 */
export function renderWithContext(
  ui: ReactElement,
  {
    mocks = [],
    route = '/',
    token = null,
  }: { mocks?: readonly MockLink.MockedResponse[]; route?: string; token?: string | null } = {},
) {
  const store = createStore();
  store.set(odbTokenAtom, token);
  return render(
    <JotaiProvider store={store}>
      <MockedProvider mocks={[...mocks]}>
        <PrimeReactProvider>
          <ToastProvider>
            <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
          </ToastProvider>
        </PrimeReactProvider>
      </MockedProvider>
    </JotaiProvider>,
  );
}
