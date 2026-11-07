import { displayName } from '@gemini-hlsw/lucuma-common-ui';
import { useStore } from 'jotai';
import type { JSX } from 'react';
import { useSearchParams } from 'react-router';

import { carrySelection, searchString } from '@/app/carriedSelection';
import { setClockPreference, useClockPreference } from '@/app/useClockPreference';
import { useSelection } from '@/app/useSelection';
import { signOut } from '@/auth/session';
import { signInUrl } from '@/auth/ssoClient';
import { useUser } from '@/components/atoms/auth';

import { Navbar } from './Navbar';

export function NavbarContainer(): JSX.Element {
  const [params] = useSearchParams();
  const { site, setSite } = useSelection();
  const { value: timeDisplay } = useClockPreference();
  const { user } = useUser();
  const store = useStore();

  // The gate mounts the masthead only with a session, so a null user never reaches the eye.
  const accountLabel = user === null ? '' : displayName(user);

  return (
    <Navbar
      homeSearch={searchString(carrySelection(params, ['site']))}
      site={site}
      onSiteChange={setSite}
      timeDisplay={timeDisplay}
      onTimeDisplayChange={setClockPreference}
      accountLabel={accountLabel}
      isGuest={user?.type === 'guest'}
      signInHref={signInUrl()}
      onSignOut={() => void signOut(store)}
    />
  );
}
