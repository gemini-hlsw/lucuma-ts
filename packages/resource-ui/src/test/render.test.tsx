import { displayName } from '@gemini-hlsw/lucuma-common-ui';
import { beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';

import { signOut, startSession } from '@/auth/session';
import { odbTokenAtom, sessionCheckedAtom, useSessionStatus, useUser } from '@/components/atoms/auth';
import { fakeJwt, standardUser } from '@/test/factories';
import { Probe } from '@/test/probe';
import { ssoCalls, ssoLogout, stubSso } from '@/test/sso';

import { renderWithContext } from './render';

beforeEach(() => {
  stubSso();
});

const SESSION_PROBE = (
  <Probe
    use={() => ({ user: useUser(), status: useSessionStatus() })}
    readout={({ user, status }) => ({ user: user ? displayName(user) : 'none', status })}
  />
);

const openProbe = (options: Parameters<typeof renderWithContext>[1]) => renderWithContext(SESSION_PROBE, options);

describe(renderWithContext, () => {
  it('signs the rendered tree in on the store the keeper and signOut read', async () => {
    const token = fakeJwt(standardUser('staff'));
    const screen = await openProbe({ token });
    await expect.element(screen.getByTestId('probe-user')).toHaveTextContent('Ada Lovelace');
    await expect.element(screen.getByTestId('probe-status')).toHaveTextContent('signed-in');
    expect(screen.store.get(odbTokenAtom)).toBe(token);

    const stop = startSession(screen.store);
    expect(ssoCalls()).toHaveLength(0);
    stop();

    const signedOut = signOut(screen.store);
    ssoLogout().answer({ status: 200 });
    expect(await signedOut).toEqual({ reachedSso: true });

    await expect.element(screen.getByTestId('probe-status')).toHaveTextContent('signed-out');
  });

  it('gives each tree rendered in one test a store of its own', async () => {
    const signedIn = await openProbe({ token: fakeJwt(standardUser('staff')) });
    const visitor = await openProbe({ token: null, sessionChecked: false });

    const statusIn = (tree: { container: HTMLElement }) =>
      page.elementLocator(tree.container).getByTestId('probe-status');
    await expect.element(statusIn(signedIn)).toHaveTextContent('signed-in');
    await expect.element(statusIn(visitor)).toHaveTextContent('checking');
    expect(visitor.store).not.toBe(signedIn.store);
    expect(visitor.store.get(odbTokenAtom)).toBeNull();
    expect(signedIn.store.get(sessionCheckedAtom)).toBe(true);
  });

  it('renders signed out with no token', async () => {
    const screen = await openProbe({});

    await expect.element(screen.getByTestId('probe-user')).toHaveTextContent('none');
    await expect.element(screen.getByTestId('probe-status')).toHaveTextContent('signed-out');
  });

  it('renders checking while the session has not been checked yet', async () => {
    const screen = await openProbe({ sessionChecked: false });

    await expect.element(screen.getByTestId('probe-status')).toHaveTextContent('checking');
  });
});
