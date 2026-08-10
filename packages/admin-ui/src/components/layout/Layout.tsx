import './Layout.css';

import { cn } from '@gemini-hlsw/lucuma-common-ui';
import { useSetAtom } from 'jotai';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { type JSX, useState } from 'react';
import { NavLink, Outlet } from 'react-router';

import { useTheme } from '@/app/useTheme';
import { CURRENT_ENV, type Environment } from '@/auth/environments';
import * as sso from '@/auth/ssoClient';
import { displayName, type StandardRole } from '@/auth/user';
import { odbTokenAtom, useIsLoggedIn, useUser } from '@/components/atoms/auth';
import { Bars, Copy, SignOut } from '@/components/Icons';
import { useToast } from '@/components/toastContext';

/** Environment → the version-string suffix, matching Explore's scheme. The
 *  complete set of environment names (satisfies Record) so a new environment is
 *  a compile error here, not a missing suffix. */
const ENV_SUFFIX = {
  development: 'DEV',
  staging: 'STAGING',
  production: 'PROD',
} as const satisfies Record<Environment['name'], string>;

/** The build version in Explore's `DATE-COMMIT-ENV` form (sc-9615): the
 *  `YYYYMMDD-commit` baked in at build time (vite.config.ts) plus the runtime
 *  environment suffix — resolved here rather than at build time because one
 *  bundle serves every environment by hostname. Shown in the About dialog so a
 *  bug report can name the exact build. */
const DISPLAY_VERSION = `${import.meta.env.FRONTEND_VERSION}-${ENV_SUFFIX[CURRENT_ENV.name]}`;

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
  const [aboutOpen, setAboutOpen] = useState(false);
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

  const copyVersion = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(DISPLAY_VERSION);
      toast.success('Version copied', DISPLAY_VERSION);
    } catch {
      toast.error('Copy failed', 'Select the version text and copy it manually.');
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
            {user ? displayName(user) : 'Not signed in'}
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
          <button
            type="button"
            className="xp-icon-btn"
            title="About this build"
            aria-label="About this build"
            onClick={() => setAboutOpen(true)}
          >
            <Bars />
          </button>
        </div>
      </header>

      {/* About dialog (sc-9615) — mirrors Explore's: the wordmark, then the
          build version with a copy button, so it can be pasted into a bug
          report. */}
      <Dialog
        visible={aboutOpen}
        onHide={() => setAboutOpen(false)}
        dismissableMask
        resizable={false}
        className="xp-about-dialog"
        header={<span className="xp-wordmark">ADMIN</span>}
      >
        <div className="xp-about">
          <span className="xp-about-version">Version: {DISPLAY_VERSION}</span>
          <button
            type="button"
            className="xp-icon-btn"
            title="Copy the version to the clipboard"
            aria-label="Copy version"
            onClick={() => void copyVersion()}
          >
            <Copy />
          </button>
        </div>
      </Dialog>

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
