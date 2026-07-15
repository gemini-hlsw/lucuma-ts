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
import { SignOut } from '@/components/Icons';
import { useToast } from '@/components/toastContext';

/** The Admin views (Shortcut epic 5747), in rail order. Views register here
 *  and in app/router.tsx. */
interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly tip: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  {
    to: '/programs',
    label: 'Programs',
    tip: 'Edit administrative parameters of an awarded program: class, ToO status, contact scientists, active period, and time awards.',
  },
  {
    to: '/proposals',
    label: 'Proposals',
    tip: 'Review & respond to special proposals — Director\u2019s Time and Poor Weather.',
  },
  {
    to: '/change-requests',
    label: 'Change Requests',
    tip: 'Review & respond to configuration-change requests from PIs.',
  },
  {
    to: '/users',
    label: 'Users',
    tip: 'Assign staff & NGO roles to users (changes require the admin role).',
  },
  {
    to: '/cfp',
    label: 'Calls for Proposals',
    tip: 'Create & update Calls for Proposals: type, semester, active window, coordinate limits, instruments, and partner deadlines.',
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

  const toast = useToast();
  const user = useUser();
  const isLoggedIn = useIsLoggedIn();
  const setToken = useSetAtom(odbTokenAtom);
  const role = user?.type === 'standard' ? user.role.type : (user?.type ?? 'guest');
  // Every role on the account (active + others), for the header role menu.
  const allRoles: readonly StandardRole[] = user?.type === 'standard' ? [user.role, ...user.otherRoles] : [];
  const roleLabel = (r: StandardRole): string =>
    r.type === 'ngo' && r.partner ? `NGO · ${r.partner.toUpperCase()}` : r.type.toUpperCase();

  const switchRole = async (next: StandardRole): Promise<void> => {
    try {
      setToken(await sso.setRole(next.id));
    } catch (err) {
      toast.error('Role switch failed', err instanceof Error ? err.message : String(err));
    }
  };

  // Drop the local token first — that alone signs the app out — then end the
  // SSO session, reporting a failure (the cookie expires on its own).
  const signOut = async (): Promise<void> => {
    setToken(null);
    try {
      await sso.logout();
    } catch (err) {
      toast.error('Sign-out incomplete', err instanceof Error ? err.message : String(err));
    }
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
              <SignOut />
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
