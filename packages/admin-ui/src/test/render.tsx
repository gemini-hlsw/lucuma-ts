import type { MockLink } from '@apollo/client/testing';
import { AtomsAndApollo } from '@gemini-hlsw/lucuma-common-ui/testing';
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
 * Render helper for Admin tests: common-ui's Jotai + Apollo core wrapped in the
 * providers this app needs (PrimeReact, toasts, a memory router). Pass GraphQL
 * `mocks` to drive Apollo-backed components and `token` to render as a signed-in
 * user (build one with test/factories.ts's fakeJwt).
 */
export function renderWithContext(
  ui: ReactElement,
  {
    mocks = [],
    route = '/',
    token = null,
  }: { mocks?: readonly MockLink.MockedResponse[]; route?: string; token?: string | null } = {},
) {
  return render(
    <AtomsAndApollo initialValues={[[odbTokenAtom, token]]} mocks={mocks}>
      <PrimeReactProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
        </ToastProvider>
      </PrimeReactProvider>
    </AtomsAndApollo>,
  );
}
