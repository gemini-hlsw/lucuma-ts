import { useToast } from '@gemini-hlsw/lucuma-common-ui';
import type { ToastMessage } from 'primereact/toast';
import { type JSX, useEffect } from 'react';

import { type SessionEnding, useSessionEnding, useSessionStatus } from '@/components/atoms/auth';

import { SessionNotices } from './SessionNotices';

const LOGIN_LABEL = 'Login with ORCID';
const SESSION_ENDED_TOAST = {
  severity: 'warn',
  summary: 'Your session ended',
  detail: `Choose "${LOGIN_LABEL}" from the menu to sign in again.`,
  sticky: true,
} as const satisfies ToastMessage;
const SIGNED_OUT_ELSEWHERE_TOAST = {
  severity: 'info',
  summary: 'You signed out in another tab',
  sticky: true,
} as const satisfies ToastMessage;
const LOGOUT_UNREACHABLE_TOAST = {
  severity: 'warn',
  summary: 'Logout did not reach SSO',
  detail: 'Close the browser to end the session.',
  sticky: true,
} as const satisfies ToastMessage;

function noticeFor(ending: SessionEnding): ToastMessage | null {
  switch (ending) {
    case 'lapsed':
      return SESSION_ENDED_TOAST;
    case 'logged-out-elsewhere':
      return SIGNED_OUT_ELSEWHERE_TOAST;
    case 'logout-missed-sso':
      return LOGOUT_UNREACHABLE_TOAST;
    case 'none':
    case 'logging-out':
    case 'logged-out':
      return null;
  }
}

const isOwnLogout = (ending: SessionEnding): boolean =>
  ending === 'logging-out' || ending === 'logged-out' || ending === 'logout-missed-sso';

/** Every notice about the session itself, shown from above the shell so they outlive the masthead. */
export function SessionNoticesContainer(): JSX.Element {
  const { status } = useSessionStatus();
  const { ending } = useSessionEnding();
  const toast = useToast();

  useEffect(() => {
    if (status === 'signed-in') {
      toast?.remove(SESSION_ENDED_TOAST);
      toast?.remove(LOGOUT_UNREACHABLE_TOAST);
      toast?.remove(SIGNED_OUT_ELSEWHERE_TOAST);
    }
  }, [status, toast]);

  useEffect(() => {
    const notice = noticeFor(ending);
    if (notice !== null) toast?.show(notice);
  }, [ending, toast]);

  const announcement = status !== 'signed-in' && isOwnLogout(ending) ? 'Logged out' : '';
  return <SessionNotices announcement={announcement} />;
}
