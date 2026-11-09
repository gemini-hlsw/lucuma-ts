import { Astronaut, cn, LayerGroup } from '@gemini-hlsw/lucuma-common-ui';
import { Button } from 'primereact/button';
import { type JSX, useEffect, useId, useRef } from 'react';

import { PRODUCT_NAME } from '@/app/product';
import orcidLogo from '@/assets/orcid-logo.svg';

export const LOGIN_WITH_ORCID = 'Login with ORCID';

const SPLASH_CONTROL = 'w-full justify-center';

export type GuestSignIn = 'idle' | 'pending' | 'failed';

export interface SplashProps {
  readonly signInHref: string;
  readonly guestSignIn: GuestSignIn;
  readonly onContinueAsGuest: () => void;
}

export function Splash({ signInHref, guestSignIn, onContinueAsGuest }: SplashProps): JSX.Element {
  const headingId = useId();
  const landmark = useRef<HTMLElement>(null);
  const guest = useRef<Button>(null);

  // Chrome paints script-moved focus as keyboard focus until the first pointer input, so a focused control would wear its outline on every load.
  useEffect(() => {
    landmark.current?.focus();
  }, []);

  // Loading disables the button and drops focus to the body; by the time this effect runs the failed render has enabled it again.
  useEffect(() => {
    if (guestSignIn === 'failed' && guest.current instanceof HTMLButtonElement) guest.current.focus();
  }, [guestSignIn]);

  return (
    <main
      ref={landmark}
      tabIndex={-1}
      aria-labelledby={headingId}
      className="xp-splash flex min-h-0 flex-col justify-center gap-8 px-6 text-foreground outline-none md:grid md:grid-cols-2 md:gap-0 md:px-0"
    >
      <div className="flex flex-col items-center gap-4 md:items-end md:justify-center md:border-r md:border-subtle md:bg-surface md:pr-16">
        {/* Two instances, not one: FontAwesome's size prop is not responsive, and its own display rule beats a hidden utility on the svg. */}
        <div className="md:hidden">
          <LayerGroup size="5x" widthAuto aria-hidden="true" className="text-gpp" />
        </div>
        <div className="max-md:hidden">
          <LayerGroup size="8x" widthAuto aria-hidden="true" className="text-gpp" />
        </div>
        <div className="flex flex-col items-center gap-1 md:items-end">
          <span className="xp-wordmark">{PRODUCT_NAME}</span>
          <p className="max-w-2xs text-center text-sm text-balance text-foreground-secondary md:text-right">
            Telescope calendar and operational-resource manager
          </p>
        </div>
      </div>
      <div className="flex flex-col items-center gap-4 md:items-start md:justify-center md:pr-6 md:pl-16">
        <h1 id={headingId} className="text-base font-semibold">
          Sign in to read the schedule
        </h1>
        <div className="flex w-full max-w-xs flex-col gap-3">
          {/* An anchor in the button's clothes: PrimeReact's Button renders only a <button>, and SSO sign-in is a navigation. */}
          <a href={signInHref} className={cn('p-button p-component p-button-secondary p-button-lg', SPLASH_CONTROL)}>
            <img
              src={orcidLogo}
              alt=""
              aria-hidden="true"
              className="p-button-icon p-button-icon-left h-[1em] w-[1.25em] object-contain"
            />
            <span className="p-button-label">{LOGIN_WITH_ORCID}</span>
          </a>
          <Button
            ref={guest}
            type="button"
            severity="secondary"
            size="large"
            label="Continue as Guest"
            className={SPLASH_CONTROL}
            loading={guestSignIn === 'pending'}
            onClick={onContinueAsGuest}
            icon={<Astronaut className="p-button-icon p-button-icon-left" aria-hidden="true" />}
          />
        </div>
      </div>
    </main>
  );
}
