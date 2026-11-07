import { useToastApi } from '@gemini-hlsw/lucuma-common-ui';
import { useStore } from 'jotai';
import { type JSX, useState } from 'react';

import { setToken } from '@/components/atoms/auth';

import { type GuestSignIn, Splash } from './Splash';
import { guestLogin, signInUrl } from './ssoClient';

export const GUEST_FAILED = 'Could not start a guest session';

export function SplashContainer(): JSX.Element {
  const store = useStore();
  const toast = useToastApi();
  const [guestSignIn, setGuestSignIn] = useState<GuestSignIn>('idle');

  const handleContinueAsGuest = async (): Promise<void> => {
    setGuestSignIn('pending');
    const token = await guestLogin();
    if (token !== null) {
      setToken(store, token);
      return;
    }
    setGuestSignIn('failed');
    toast.error(GUEST_FAILED);
  };

  return (
    <Splash signInHref={signInUrl()} guestSignIn={guestSignIn} onContinueAsGuest={() => void handleContinueAsGuest()} />
  );
}
