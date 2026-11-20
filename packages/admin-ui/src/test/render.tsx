import { ApolloLink } from '@apollo/client';
import { MockLink } from '@apollo/client/testing';
import { Observable } from '@apollo/client/utilities';
import { ToastOutlet } from '@gemini-hlsw/lucuma-common-ui';
import { AtomsAndApollo } from '@gemini-hlsw/lucuma-common-ui/testing';
import { PrimeReactProvider } from 'primereact/api';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { render } from 'vitest-browser-react';

import { odbTokenAtom } from '@/components/atoms/auth';

// The typed-mock helper is shared from common-ui; re-exported so tests can keep
// importing it alongside renderWithContext from this module.
export type { MockedResponseOf } from '@gemini-hlsw/lucuma-common-ui/testing';

/**
 * Render helper for Admin tests: common-ui's Jotai + Apollo core wrapped in the
 * providers this app needs (PrimeReact, toasts, a memory router). Pass GraphQL
 * `mocks` to drive Apollo-backed components and `token` to render as a signed-in
 * user (build one with fakeJwt from @gemini-hlsw/lucuma-common-ui/testing).
 * `hold` keeps each named operation from its mock until its promise settles; a
 * function gives the promise per request, or undefined to let that one through.
 */
export function renderWithContext(
  ui: ReactElement,
  {
    mocks = [],
    route = '/',
    token = null,
    hold,
  }: {
    mocks?: readonly MockLink.MockedResponse[];
    route?: string;
    token?: string | null;
    hold?: Hold;
  } = {},
) {
  const link = hold && ApolloLink.from([holding(hold), new MockLink(mocks)]);
  return render(
    <AtomsAndApollo initialValues={[[odbTokenAtom, token]]} {...(link ? { link } : { mocks })}>
      <PrimeReactProvider>
        <ToastOutlet position="bottom-right" />
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </PrimeReactProvider>
    </AtomsAndApollo>,
  );
}

type Hold = Readonly<Record<string, Promise<unknown> | (() => Promise<unknown> | undefined)>>;

/** Passes each operation on once its promise in `hold`, if any, has settled. */
function holding(hold: Hold): ApolloLink {
  return new ApolloLink((operation, forward) => {
    const entry = hold[operation.operationName ?? ''];
    const until = typeof entry === 'function' ? entry() : entry;
    if (!until) return forward(operation);
    return new Observable((observer) => {
      let inner: { unsubscribe: () => void } | undefined;
      let closed = false;
      const go = () => {
        if (!closed) inner = forward(operation).subscribe(observer);
      };
      // Both ways, so a rejected hold is not an unhandled rejection.
      void until.then(go, go);
      return () => {
        closed = true;
        inner?.unsubscribe();
      };
    });
  });
}
