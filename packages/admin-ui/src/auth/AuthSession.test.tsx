import { fakeJwt, standardUser } from '@gemini-hlsw/lucuma-common-ui/testing';
import {
  ssoCalls,
  ssoRefreshes,
  ssoRoleRequested,
  ssoRoleSwitches,
  stubSso,
} from '@gemini-hlsw/lucuma-common-ui/testing/sso.ts';
import type { JSX } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StandardRole } from '@/auth/user';
import { useUser } from '@/components/atoms/auth';
import { renderWithContext } from '@/test/render';

import { AuthSession } from './AuthSession';

function ActiveRole(): JSX.Element {
  const user = useUser();
  return <p data-testid="role">{user?.type === 'standard' ? user.role.type : 'none'}</p>;
}

const holding = (active: StandardRole['type'], ...otherRoles: StandardRole[]): string =>
  fakeJwt({ ...standardUser(active), otherRoles });

const renderSession = (token: string) =>
  renderWithContext(
    <>
      <AuthSession />
      <ActiveRole />
    </>,
    { token },
  );

beforeEach(() => {
  stubSso();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe(AuthSession, () => {
  it.each([
    ['staff', { type: 'staff', id: 'r-staff' }],
    ['admin', { type: 'admin', id: 'r-admin' }],
  ] as const)('switches a signed-in user to the %s role they hold, and signs them in with it', async (type, role) => {
    const screen = await renderSession(holding('pi', { type: 'ngo', id: 'r-ngo' }, role));
    await expect.element(screen.getByTestId('role')).toHaveTextContent('pi');

    await expect.poll(() => ssoRoleSwitches()).toHaveLength(1);
    expect(ssoRoleRequested()).toBe(role.id);
    ssoRoleSwitches()[0]?.answer({ status: 200 });

    await expect.poll(() => ssoRefreshes()).toHaveLength(1);
    ssoRefreshes()[0]?.answer({ body: fakeJwt({ ...standardUser(type), role }) });

    await expect.element(screen.getByTestId('role')).toHaveTextContent(type);
  });

  it('toasts the reason when SSO refuses the role switch', async () => {
    const screen = await renderSession(holding('pi', { type: 'staff', id: 'r-staff' }));

    await expect.poll(() => ssoRoleSwitches()).toHaveLength(1);
    ssoRoleSwitches()[0]?.answer({ status: 403, body: 'User does not own role.' });

    await expect.element(screen.getByText('Role switch failed')).toBeVisible();
    await expect.element(screen.getByText(/User does not own role/)).toBeVisible();
    expect(screen.getByTestId('role').element()).toHaveTextContent('pi');
  });

  it.each(['staff', 'admin'] as const)('leaves a user already acting as %s alone', async (type) => {
    const screen = await renderSession(holding(type, { type: 'pi', id: 'r-pi' }));

    await expect.element(screen.getByTestId('role')).toHaveTextContent(type);
    expect(ssoCalls()).toHaveLength(0);
  });
});
