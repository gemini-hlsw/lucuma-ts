import { fakeJwt, standardUser } from '@gemini-hlsw/lucuma-common-ui/testing';
import { createStore } from 'jotai';
import { beforeEach, describe, expect, it } from 'vitest';

import { pendingRefresh, startSession } from '@/auth/session';
import { odbTokenAtom, sessionCheckedAtom, sessionStatusAtom, useSessionStatus } from '@/components/atoms/auth';
import { Probe } from '@/test/probe';
import { renderApp } from '@/test/renderApp';
import { ssoCall, ssoRefreshes, stubSso } from '@/test/sso';

beforeEach(() => {
  stubSso();
});

describe('session state between tests', () => {
  it('signs a tree in through renderApp', async () => {
    const screen = await renderApp({
      route: '/',
      token: fakeJwt(standardUser('staff')),
      element: <Probe use={() => useSessionStatus()} readout={(status) => ({ status })} />,
      mocks: [],
    });

    await expect.element(screen.getByTestId('probe-status')).toHaveTextContent('signed-in');
  });

  it('should bootstrap signed out when the next test starts a keeper on a fresh store', async () => {
    const store = createStore();
    const stop = startSession(store);

    expect(store.get(sessionCheckedAtom)).toBe(false);
    expect(ssoRefreshes()).toHaveLength(1);

    const settled = pendingRefresh();
    ssoCall(0).answer({ status: 403 });
    await settled;

    expect(store.get(odbTokenAtom)).toBeNull();
    expect(store.get(sessionStatusAtom)).toBe('signed-out');

    stop();
  });
});
