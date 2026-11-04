import { ApolloClient, ApolloLink, gql, InMemoryCache } from '@apollo/client';
import { ApolloProvider, useQuery } from '@apollo/client/react';
import { Observable } from '@apollo/client/utilities';
import { createStore, Provider as JotaiProvider, type Store } from 'jotai';
import { type ReactNode, StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { odbTokenAtom, sessionCheckedAtom, useSessionStatus } from './atoms.ts';
import { createSession, type RoleSwitchOutcome, type Session } from './session.ts';
import { ssoCalls, ssoJwt, ssoRefreshes, ssoRoleSwitches, ssoUser, stubSso } from './testing/sso.ts';
import { type SessionKeeperOptions, useSessionKeeper } from './useSessionKeeper.ts';

const SSO = 'https://sso.example.test';
const CHANNEL = 'common-ui-test-keeper';

const PROBE = gql`
  query Probe {
    __typename
  }
`;

let store: Store;
let session: Session;

/** A real client. Its link records each operation name it sends. */
function countingClient() {
  const sent: string[] = [];
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink((operation) => {
      sent.push(operation.operationName ?? '');
      return new Observable<ApolloLink.Result>((observer) => {
        observer.next({ data: { __typename: 'Query' } });
        observer.complete();
      });
    }),
  });
  return { client, sent };
}

/** Keeps `session` running while mounted, and renders its children. */
function Keeper({
  session,
  children = null,
  ...options
}: SessionKeeperOptions & { readonly session: Session; readonly children?: ReactNode }): ReactNode {
  useSessionKeeper(session, options);
  return children;
}

function Status(): ReactNode {
  return <p data-testid="status">{useSessionStatus()}</p>;
}

function ProbeQuery(): ReactNode {
  const { loading } = useQuery(PROBE, { fetchPolicy: 'network-only' });
  return <p data-testid="probe">{loading ? 'loading' : 'done'}</p>;
}

beforeEach(() => {
  stubSso();
  sessionStorage.clear();
  store = createStore();
  store.set(odbTokenAtom, null);
  session = createSession({ store, ssoUri: SSO, channelName: CHANNEL });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe(useSessionKeeper, () => {
  it('starts the session on mount, renders its children, and signs the reader in', async () => {
    const screen = await render(
      <StrictMode>
        <JotaiProvider store={store}>
          <Keeper session={session}>
            <Status />
          </Keeper>
        </JotaiProvider>
      </StrictMode>,
    );
    await expect.element(screen.getByTestId('status')).toHaveTextContent('checking');

    // StrictMode mounts twice; only the second bootstrap is still listening.
    await expect.poll(() => ssoRefreshes().filter((made) => !made.signal?.aborted)).toHaveLength(1);
    const settled = session.pendingRefresh();
    ssoRefreshes()
      .find((made) => !made.signal?.aborted)
      ?.answer({ body: ssoJwt(ssoUser('staff')) });
    await settled;

    await expect.element(screen.getByTestId('status')).toHaveTextContent('signed-in');
  });

  it('stops the session on unmount, so no refresh timer survives it', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    store.set(odbTokenAtom, ssoJwt(ssoUser('staff'), 120));

    const screen = await render(<Keeper session={session} />);
    await screen.unmount();
    vi.advanceTimersByTime(200_000);

    expect(ssoCalls()).toHaveLength(0);
  });

  it('refetches the open queries when the reader signs in or out or switches role, but not on a renewal', async () => {
    const { client, sent } = countingClient();
    store.set(odbTokenAtom, ssoJwt(ssoUser('staff')));
    store.set(sessionCheckedAtom, true);
    const screen = await render(
      <ApolloProvider client={client}>
        <Keeper session={session} client={client}>
          <ProbeQuery />
        </Keeper>
      </ApolloProvider>,
    );
    await expect.element(screen.getByTestId('probe')).toHaveTextContent('done');
    expect(sent).toEqual(['Probe']);

    store.set(odbTokenAtom, ssoJwt(ssoUser('staff'), 7200));
    store.set(odbTokenAtom, null);
    await expect.poll(() => sent).toEqual(['Probe', 'Probe']);

    store.set(odbTokenAtom, ssoJwt(ssoUser('staff')));
    await expect.poll(() => sent).toEqual(['Probe', 'Probe', 'Probe']);

    store.set(odbTokenAtom, ssoJwt(ssoUser('admin')));
    await expect.poll(() => sent).toEqual(['Probe', 'Probe', 'Probe', 'Probe']);
  });

  it('hands each role-switch outcome to the latest onRoleSwitch it was given', async () => {
    session = createSession({ store, ssoUri: SSO, channelName: CHANNEL, preferRoles: ['staff'] });
    store.set(odbTokenAtom, ssoJwt(ssoUser('pi', [{ type: 'staff', id: 'r-staff' }])));
    const first = vi.fn<(outcome: RoleSwitchOutcome) => void>();
    const latest = vi.fn<(outcome: RoleSwitchOutcome) => void>();

    const screen = await render(<Keeper session={session} onRoleSwitch={first} />);
    await screen.rerender(<Keeper session={session} onRoleSwitch={latest} />);
    expect(ssoRoleSwitches()).toHaveLength(1);
    ssoRoleSwitches()[0]?.answer({ status: 403 });

    await expect.poll(() => latest.mock.calls).toEqual([[expect.objectContaining({ kind: 'failed' })]]);
    expect(first).not.toHaveBeenCalled();
  });
});
