import './AuthGate.css';

import { Button } from 'primereact/button';
import type { JSX, ReactNode } from 'react';

import { useCanAccessAdmin, useIsLoggedIn, useUser } from '@/components/atoms/auth';

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

  if (!isLoggedIn) {
    return (
      <GateScreen icon="pi-sign-in" title="GPP Admin">
        <p>
          The Admin interface is restricted to Gemini <strong>staff</strong> and <strong>admin</strong> users. Sign in
          with your ORCID to continue.
        </p>
        <div className="gate-actions">
          <Button
            label="Sign in with ORCID"
            icon="pi pi-sign-in"
            onClick={() => (window.location.href = sso.signInUrl())}
          />
        </div>
      </GateScreen>
    );
  }

  if (!canAccessAdmin) {
    return (
      <GateScreen icon="pi-lock" title="Access denied">
        <p>
          The Admin interface is restricted to <strong>staff</strong> and <strong>admin</strong> users; you are signed
          in as <strong>{currentAccess(user).toUpperCase()}</strong>. An admin can grant a staff role from the Users
          view.
        </p>
        <div className="gate-actions">
          <Button
            label="Sign out"
            icon="pi pi-sign-out"
            outlined
            onClick={() => void sso.logout().then(() => window.location.reload())}
          />
        </div>
      </GateScreen>
    );
  }

  return <>{children}</>;
}

function GateScreen({ icon, title, children }: { icon: string; title: string; children: ReactNode }): JSX.Element {
  return (
    <div className="gate-screen">
      <div className="gate-card">
        <i className={`pi ${icon} gate-icon`} />
        <h1>{title}</h1>
        <div className="gate-body">{children}</div>
      </div>
    </div>
  );
}
