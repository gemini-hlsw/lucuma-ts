import './AuthGate.css';

import { Lock, SignIn, SignOut } from '@gemini-hlsw/lucuma-common-ui';
import { Button } from 'primereact/button';
import type { JSX, ReactNode } from 'react';

import { useCanAccessAdmin, useIsLoggedIn, useUser } from '@/components/atoms/auth';

import { useSession } from './session';
import * as sso from './ssoClient';
import { currentAccess } from './user';

/**
 * Gates the whole app on role: not signed in → the sign-in screen; signed in
 * below staff → access denied, showing the actual role; staff/admin → the app.
 * The gate is a UI courtesy — the ODB and SSO enforce the same requirement on
 * every admin operation server-side.
 */
export function AuthGate({ children }: { children: ReactNode }): JSX.Element {
  const user = useUser();
  const isLoggedIn = useIsLoggedIn();
  const canAccessAdmin = useCanAccessAdmin();
  const session = useSession();

  if (!isLoggedIn) {
    return (
      <GateScreen icon={<SignIn className="gate-icon" />} title="GPP Admin">
        <p>
          The Admin interface is restricted to Gemini <strong>staff</strong> and <strong>admin</strong> users. Sign in
          with your ORCID to continue.
        </p>
        <div className="gate-actions">
          <Button
            label="Sign in with ORCID"
            icon={<SignIn />}
            onClick={() => (window.location.href = sso.signInUrl())}
          />
        </div>
      </GateScreen>
    );
  }

  if (!canAccessAdmin) {
    return (
      <GateScreen icon={<Lock className="gate-icon" />} title="Access denied">
        <p>
          The Admin interface is restricted to <strong>staff</strong> and <strong>admin</strong> users; you are signed
          in as <strong>{currentAccess(user).toUpperCase()}</strong>. An admin can grant a staff role from the Users
          view.
        </p>
        <div className="gate-actions">
          {/* A failed SSO logout is ignored: the cookie expires on its own. */}
          <Button label="Sign out" icon={<SignOut />} outlined onClick={() => void session.signOut()} />
        </div>
      </GateScreen>
    );
  }

  return <>{children}</>;
}

function GateScreen({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }): JSX.Element {
  return (
    <div className="gate-screen">
      <div className="gate-card">
        {icon}
        <h1>{title}</h1>
        <div className="gate-body">{children}</div>
      </div>
    </div>
  );
}
