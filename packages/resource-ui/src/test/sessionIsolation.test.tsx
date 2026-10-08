import { beforeEach, describe, expect, it } from 'vitest';

import { pendingRefresh, startSession } from '@/auth/session';
import { odbTokenAtom, sessionCheckedAtom, sessionStatusAtom, useSessionStatus } from '@/components/atoms/auth';
import { store } from '@/components/atoms/store';
import { fakeJwt, standardUser } from '@/test/factories';
import { Probe } from '@/test/probe';
import { renderWithContext } from '@/test/render';
import { ssoCall, ssoRefreshes, stubSso } from '@/test/sso';

beforeEach(() => {
  stubSso();
});

describe('session state between tests', () => {
  it('signs a tree in through renderWithContext on the module store', async () => {
    const screen = await renderWithContext(
      <Probe use={() => useSessionStatus()} readout={(status) => ({ status })} />,
      { token: fakeJwt(standardUser('staff')), store },
    );

    await expect.element(screen.getByTestId('probe-status')).toHaveTextContent('signed-in');
  });

  it('starts the next test signed out, so a bootstrap asks SSO', async () => {
    const stop = startSession();

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
