import { fakeJwt, standardUser } from '@gemini-hlsw/lucuma-common-ui/testing';
import {
  ssoLogout,
  ssoRefreshes,
  ssoRoleRequested,
  ssoRoleSwitches,
  stubSso,
} from '@gemini-hlsw/lucuma-common-ui/testing/sso.ts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { AuthSession } from '@/auth/AuthSession';
import type { StandardRole } from '@/auth/user';
import { renderWithContext } from '@/test/render';

import Layout from './Layout';

afterEach(() => {
  vi.unstubAllGlobals();
});

const STAFF: StandardRole = { type: 'staff', id: 'r-1' };
const ADMIN: StandardRole = { type: 'admin', id: 'r-2' };

/** Layout with the session keeper running, as in `main.tsx`. The user has `active` and `other` roles. */
const renderKeptLayout = (active: StandardRole, other: StandardRole) =>
  renderWithContext(
    <>
      <AuthSession />
      <Layout />
    </>,
    { token: fakeJwt({ ...standardUser(active.type), role: active, otherRoles: [other] }) },
  );

/** Pick `next` from the header's role dropdown, which shows `current`. The dropdown also has a
 *  hidden native select, so this clicks the visible option. */
async function pickRole(
  screen: Awaited<ReturnType<typeof renderKeptLayout>>,
  current: string,
  next: string,
): Promise<void> {
  await userEvent.click(screen.getByText(current, { exact: true }).last());
  await userEvent.click(screen.getByRole('option', { name: next }).last());
}

describe(Layout, () => {
  it('shows the wordmark, environment pill, and signed-in user', async () => {
    const screen = await renderWithContext(<Layout />, { token: fakeJwt(standardUser('staff')) });
    await expect.element(screen.getByText('ADMIN')).toBeInTheDocument();
    await expect.element(screen.getByText('development')).toBeInTheDocument();
    // The name shares its element with the role badge, so match on part of the text.
    await expect.element(screen.getByText('Ada Lovelace', { exact: false })).toBeInTheDocument();
    await expect.element(screen.getByText('STAFF')).toBeInTheDocument();
  });

  it('reveals the build version from the About dialog (sc-9615)', async () => {
    const screen = await renderWithContext(<Layout />, { token: fakeJwt(standardUser('staff')) });
    await userEvent.click(screen.getByRole('button', { name: 'About this build' }));
    // Explore's DATE-COMMIT-ENV form, e.g. "20260806-3cdabad-DEV".
    await expect.element(screen.getByText(/Version: \d{8}-[0-9a-f]+-[A-Z]+/)).toBeInTheDocument();
  });

  it('signs out at once, and says so when SSO could not end its session', async () => {
    stubSso();
    const screen = await renderWithContext(<Layout />, { token: fakeJwt(standardUser('staff')) });

    await userEvent.click(screen.getByTitle(/^Sign out/));

    await expect.element(screen.getByText('Not signed in', { exact: false })).toBeInTheDocument();
    ssoLogout().answer({ status: 500, body: 'session store unavailable' });
    await expect.element(screen.getByText('Sign-out incomplete')).toBeVisible();
  });

  it('switches to the role picked in the header through the session keeper', async () => {
    stubSso();
    const screen = await renderKeptLayout(STAFF, ADMIN);

    await pickRole(screen, 'STAFF', 'ADMIN');
    await expect.poll(() => ssoRoleSwitches()).toHaveLength(1);
    expect(ssoRoleRequested()).toBe(ADMIN.id);
    ssoRoleSwitches()[0]?.answer({ status: 200 });
    await expect.poll(() => ssoRefreshes()).toHaveLength(1);
    ssoRefreshes()[0]?.answer({ body: fakeJwt({ ...standardUser('admin'), role: ADMIN, otherRoles: [STAFF] }) });

    await expect.element(screen.getByRole('combobox')).toHaveValue(ADMIN.id);
  });

  it('toasts the reason when SSO refuses the role picked in the header', async () => {
    stubSso();
    const screen = await renderKeptLayout(STAFF, ADMIN);

    await pickRole(screen, 'STAFF', 'ADMIN');
    await expect.poll(() => ssoRoleSwitches()).toHaveLength(1);
    ssoRoleSwitches()[0]?.answer({ status: 403, body: 'User does not own role.' });

    await expect.element(screen.getByText('Role switch failed')).toBeVisible();
    await expect.element(screen.getByText(/User does not own role/)).toBeVisible();
    expect(ssoRefreshes()).toHaveLength(0);
  });
});
