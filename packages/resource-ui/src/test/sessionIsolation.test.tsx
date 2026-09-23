import { beforeEach, describe, expect, it } from 'vitest';

import { pendingRefresh, startSession } from '@/auth/session';
import { odbTokenAtom, sessionCheckedAtom, sessionStatusAtom, useSessionStatus } from '@/components/atoms/auth';
import { store } from '@/components/atoms/store';
import { fakeJwt, standardUser } from '@/test/factories';
import { Probe } from '@/test/probe';
import { renderApp } from '@/test/renderApp';
import { type PendingSsoCall, ssoCall, ssoCalls, stubSso } from '@/test/sso';

const refreshes = (): readonly PendingSsoCall[] =>
  ssoCalls().filter((made) => made.url.includes('/api/v1/refresh-token'));

beforeEach(() => {
  stubSso();
});

describe('session state between tests', () => {
  it('signs a tree in through renderApp', async () => {
    const screen = await renderApp({
      route: '/',
      token: fakeJwt(standardUser('staff')),
      element: <Probe use={() => useSessionStatus()} readout={(status) => ({ status })} />,
    });

    await expect.element(screen.getByTestId('probe-status')).toHaveTextContent('signed-in');
  });

  it('starts the next test signed out, so a bootstrap asks SSO', async () => {
    const stop = startSession();

    expect(store.get(sessionCheckedAtom)).toBe(false);
    expect(refreshes()).toHaveLength(1);

    const settled = pendingRefresh();
    ssoCall(0).answer({ status: 403 });
    await settled;

    expect(store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionStatusAtom)).toBe('signed-out');

    stop();
  });
});
