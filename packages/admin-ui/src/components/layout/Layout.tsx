import './Layout.css';

import { cn } from '@gemini-hlsw/lucuma-common-ui';
import { useSetAtom } from 'jotai';
import { Dropdown } from 'primereact/dropdown';
import type { JSX } from 'react';
import { NavLink, Outlet } from 'react-router';

import { useTheme } from '@/app/useTheme';
import { CURRENT_ENV } from '@/auth/environments';
import * as sso from '@/auth/ssoClient';
import { displayName, type StandardRole } from '@/auth/user';
import { odbTokenAtom, useIsLoggedIn, useUser } from '@/components/atoms/auth';

/** The Admin views (Shortcut epic 5747), in rail order. Views register here
 *  and in app/router.tsx as their stories land; each tip describes what the
 *  view does and its backing GraphQL operations. */
interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly tip: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  {
    to: '/users',
    label: 'Users',
    tip: 'Assign staff & NGO roles to users. Role changes call the SSO addRole / deleteRole mutations (not the ODB). Requires an admin role to actually apply. [sc-9096]',
  },
  {
    to: '/cfp',
    label: 'Calls for Proposals',
    tip: 'Create & update Calls for Proposals (type, semester, active window, coordinate limits, instruments, partner deadlines). ODB createCallForProposals / updateCallsForProposals. [sc-9098]',
  },
];

/**
 * App shell styled after the explore GPP app: a dark masthead (letter-spaced
 * wordmark, environment pill, signed-in user with a role switcher), a vertical
 * side-tab rail, and a tiled content area. The explore look lives in
 * styles/shell.css.
 */
export default function Layout(): JSX.Element {
  // Keep the lucuma-ui-css dark theme class on <body> (explore is dark-only).
  useTheme('dark');

  const user = useUser();
  const isLoggedIn = useIsLoggedIn();
  const setToken = useSetAtom(odbTokenAtom);
  const role = user?.type === 'standard' ? user.role.type : (user?.type ?? 'guest');
  // Every role on the account (active + others), for the header role menu.
  const allRoles: readonly StandardRole[] = user?.type === 'standard' ? [user.role, ...user.otherRoles] : [];
  const roleLabel = (r: StandardRole): string =>
    r.type === 'ngo' && r.partner ? `NGO · ${r.partner.toUpperCase()}` : r.type.toUpperCase();

  const switchRole = async (next: StandardRole): Promise<void> => {
    const fresh = await sso.setRole(next.id);
    if (fresh) setToken(fresh);
  };

  const signOut = async (): Promise<void> => {
    await sso.logout();
    setToken(null);
  };

  return (
    <div className="xp-shell">
      <header className="xp-masthead">
        <span className="xp-wordmark" title="GPP Admin — internal interface for science-operations staff">
          ADMIN
        </span>

        <div className="xp-masthead-center">
          <span
            className="xp-env-pill"
            title={`Active environment: ${CURRENT_ENV.name}. SSO ${CURRENT_ENV.ssoUri}, ODB ${CURRENT_ENV.odbUri}. Resolved from the hostname (auth/environments.ts).`}
          >
            {CURRENT_ENV.name}
          </span>
        </div>

        <div className="xp-masthead-right">
          <span className="xp-user" title="The signed-in user, decoded from the SSO JWT (identity + active role).">
            {displayName(user)}
            {allRoles.length > 1 && user?.type === 'standard' ? (
              <Dropdown
                className="xp-role-select"
                value={user.role.id}
                options={allRoles.map((r) => ({ label: roleLabel(r), value: r.id }))}
                onChange={(e) => {
                  const next = allRoles.find((r) => r.id === e.value);
                  if (next && next.id !== user.role.id) void switchRole(next);
                }}
                tooltip="Your active SSO role — pick any of your account's roles to act as. Switching fetches a fresh token from SSO."
                tooltipOptions={{ position: 'bottom' }}
              />
            ) : (
              <span
                className="xp-role"
                title="Your current SSO role. The Admin app requires staff or admin; lower roles are gated out."
              >
                {role.toUpperCase()}
              </span>
            )}
          </span>
          {isLoggedIn && (
            <button
              type="button"
              className="xp-icon-btn"
              title="Sign out — clears your token and ends the SSO session"
              onClick={() => void signOut()}
            >
              <i className="pi pi-sign-out" />
            </button>
          )}
        </div>
      </header>

      <div className="xp-body">
        <nav className="xp-rail">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.tip}
              className={({ isActive }) => cn('xp-rail-tab', isActive && 'is-active')}
            >
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <main className="xp-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
