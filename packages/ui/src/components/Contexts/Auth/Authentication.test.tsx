import { ToastOutlet } from '@gemini-hlsw/lucuma-common-ui';
import {
  ssoCalls,
  ssoJwt,
  ssoRefreshes,
  ssoRoleRequested,
  ssoRoleSwitches,
  ssoUser,
  stubSso,
} from '@gemini-hlsw/lucuma-common-ui/testing/sso.ts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { odbTokenAtom, userAtom } from '@/components/atoms/auth';
import { renderWithContext } from '@/test/render';

import { Authentication } from './Authentication';

const SSO = 'https://sso-dev.gpp.gemini.edu';
const STAFF = { type: 'staff', id: 'r-staff' } as const;

const renderAuthentication = (token: string | null) =>
  renderWithContext(
    <>
      <ToastOutlet />
      <Authentication />
    </>,
    { initialValues: [[odbTokenAtom, token]] },
  );

beforeEach(() => {
  stubSso();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe(Authentication, () => {
  it('signs a returning user in from the SSO session cookie, at the configured SSO', async () => {
    const screen = await renderAuthentication(null);

    await expect.poll(() => ssoRefreshes()).toHaveLength(1);
    expect(ssoRefreshes()[0]?.url).toBe(`${SSO}/api/v1/refresh-token`);
    const token = ssoJwt(ssoUser('staff'));
    ssoRefreshes()[0]?.answer({ body: token });

    await expect.poll(() => screen.store.get(odbTokenAtom)).toBe(token);
  });

  it('switches a user who holds a staff role to it', async () => {
    const screen = await renderAuthentication(ssoJwt(ssoUser('pi', [STAFF])));

    await expect.poll(() => ssoRoleSwitches()).toHaveLength(1);
    expect(ssoRoleRequested()).toBe(STAFF.id);
    ssoRoleSwitches()[0]?.answer({ status: 200 });

    await expect.poll(() => ssoRefreshes()).toHaveLength(1);
    ssoRefreshes()[0]?.answer({ body: ssoJwt(ssoUser('staff')) });

    await expect.poll(() => screen.store.get(userAtom)).toMatchObject({ role: { type: 'staff' } });
    expect(screen.getByText(/You are not a staff user/).query()).toBeNull();
  });

  it('shows an error when SSO refuses the switch to staff', async () => {
    const screen = await renderAuthentication(ssoJwt(ssoUser('pi', [STAFF])));

    await expect.poll(() => ssoRoleSwitches()).toHaveLength(1);
    ssoRoleSwitches()[0]?.answer({ status: 403, body: 'User does not own role.' });

    await expect.element(screen.getByText(/Error while switching to role staff/)).toBeVisible();
  });

  it.each(['pi', 'admin'] as const)('warns a %s user who holds no staff role, and asks SSO nothing', async (type) => {
    const screen = await renderAuthentication(ssoJwt(ssoUser(type)));

    await expect
      .element(screen.getByText(`You are not a staff user (${type}). Some functionality might be unavailable.`))
      .toBeVisible();
    expect(ssoCalls()).toHaveLength(0);
  });

  it('neither warns nor switches a staff user', async () => {
    const screen = await renderAuthentication(ssoJwt(ssoUser('staff')));

    await expect.poll(() => screen.store.get(userAtom)).toMatchObject({ role: { type: 'staff' } });
    expect(screen.getByText(/You are not a staff user/).query()).toBeNull();
    expect(ssoCalls()).toHaveLength(0);
  });
});
