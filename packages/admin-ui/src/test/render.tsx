import type { DocumentNode, OperationVariables } from '@apollo/client';
import type { MockLink } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing/react';
import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core';
import { createStore, Provider as JotaiProvider } from 'jotai';
import { PrimeReactProvider } from 'primereact/api';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { render } from 'vitest-browser-react';

import { odbTokenAtom } from '@/components/atoms/auth';
import { ToastProvider } from '@/components/toast';

/** A MockedResponse whose variables and result are typed by the operation
 *  document (packages/ui's helper) — adding a field to a query makes every
 *  stale mock a compile error. */
export type MockedResponseOf<T extends DocumentNode> =
  VariablesOf<T> extends OperationVariables ? MockLink.MockedResponse<ResultOf<T>, VariablesOf<T>> : never;

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
