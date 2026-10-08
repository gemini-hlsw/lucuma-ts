import { displayName } from '@gemini-hlsw/lucuma-common-ui';
import { beforeEach, describe, expect, it } from 'vitest';

import { signOut } from '@/auth/session';
import { odbTokenAtom, useSessionStatus, useUser } from '@/components/atoms/auth';
import { store } from '@/components/atoms/store';
import { fakeJwt, standardUser } from '@/test/factories';
import { Probe } from '@/test/probe';
import { ssoLogout, stubSso } from '@/test/sso';

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
  it('signs the rendered tree in on the module store that authLink and signOut read', async () => {
    const token = fakeJwt(standardUser('staff'));
    const screen = await openProbe({ token, store });

    await expect.element(screen.getByTestId('probe-user')).toHaveTextContent('Ada Lovelace');
    await expect.element(screen.getByTestId('probe-status')).toHaveTextContent('signed-in');
    expect(store.get(odbTokenAtom)).toBe(token);
  });

  it('signs a store of its own in by default, not the module store', async () => {
    const token = fakeJwt(standardUser('staff'));
    const screen = await openProbe({ token });

    await expect.element(screen.getByTestId('probe-status')).toHaveTextContent('signed-in');
    expect(screen.store).not.toBe(store);
    expect(screen.store.get(odbTokenAtom)).toBe(token);
  });

  it('sets a store rendered twice to the second render s values', async () => {
    const first = await openProbe({ token: fakeJwt(standardUser('staff')), store });
    await expect.element(first.getByTestId('probe-status')).toHaveTextContent('signed-in');
    await first.unmount();

    const second = await openProbe({ token: null, store });

    await expect.element(second.getByTestId('probe-status')).toHaveTextContent('signed-out');
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

  it('is signed out by a real signOut', async () => {
    const screen = await openProbe({ token: fakeJwt(standardUser('staff')), store });
    await expect.element(screen.getByTestId('probe-status')).toHaveTextContent('signed-in');

    const signedOut = signOut();
    ssoLogout().answer({ status: 200 });
    expect(await signedOut).toEqual({ reachedSso: true });

    await expect.element(screen.getByTestId('probe-status')).toHaveTextContent('signed-out');
  });
});
