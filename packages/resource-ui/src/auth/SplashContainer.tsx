import { useToastApi } from '@gemini-hlsw/lucuma-common-ui';
import { useStore } from 'jotai';
import { type JSX, startTransition, useActionState } from 'react';

import { setToken } from '@/components/atoms/auth';

import { type GuestSignIn, Splash } from './Splash';
import { guestLogin, signInUrl } from './ssoClient';

export function SplashContainer(): JSX.Element {
  const store = useStore();
  const toast = useToastApi();

  const [outcome, continueAsGuest, pending] = useActionState(async (): Promise<Exclude<GuestSignIn, 'pending'>> => {
    const token = await guestLogin();
    if (token === null) {
      toast.error('Could not start a guest session');
      return 'failed';
    }
    setToken(store, token);
    return 'idle';
  }, 'idle');

  return (
    <Splash
      signInHref={signInUrl()}
      guestSignIn={pending ? 'pending' : outcome}
      onContinueAsGuest={() => startTransition(continueAsGuest)}
    />
  );
}
