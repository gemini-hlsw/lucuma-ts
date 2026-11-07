import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { type GuestSignIn, Splash } from './Splash';

const HEADING = 'Sign in to read the schedule';
const SIGN_IN_HREF = 'https://sso.example/auth/v1/stage1?state=here';

const splash = (guestSignIn: GuestSignIn = 'idle', onContinueAsGuest = vi.fn()) => (
  <Splash signInHref={SIGN_IN_HREF} guestSignIn={guestSignIn} onContinueAsGuest={onContinueAsGuest} />
);

afterEach(() => {
  document.body.focus();
});

describe(Splash, () => {
  it('should focus its landmark, so the first Tab lands on the ORCID control, when it mounts', async () => {
    const screen = await render(splash());

    await expect.element(screen.getByRole('main', { name: HEADING })).toHaveFocus();
    expect(screen.getByRole('link', { name: 'Login with ORCID' }).element()).not.toHaveFocus();

    await userEvent.keyboard('{Tab}');

    await expect.element(screen.getByRole('link', { name: 'Login with ORCID' })).toHaveFocus();
  });

  it('should be a main landmark named by its heading, with the tagline under the wordmark, when rendered', async () => {
    const screen = await render(splash());

    await expect.element(screen.getByRole('main', { name: HEADING })).toBeInTheDocument();
    await expect.element(screen.getByRole('heading', { level: 1, name: HEADING })).toBeInTheDocument();
    await expect.element(screen.getByText('Resource')).toBeInTheDocument();
    await expect.element(screen.getByText('Telescope calendar and operational-resource manager')).toBeInTheDocument();
  });

  it('should offer ORCID at the given href, then guest, with the ORCID logo decorative, when rendered', async () => {
    const screen = await render(splash());

    const orcid = screen.getByRole('link', { name: 'Login with ORCID' });
    const guest = screen.getByRole('button', { name: 'Continue as Guest' });
    await expect.element(orcid).toHaveAttribute('href', SIGN_IN_HREF);
    await expect.element(guest).toBeEnabled();
    expect(orcid.element().compareDocumentPosition(guest.element()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(orcid.element().querySelector('img')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('img').query()).toBeNull();
  });

  it('should report one call when guest is pressed once', async () => {
    const onContinueAsGuest = vi.fn();
    const screen = await render(splash('idle', onContinueAsGuest));

    await screen.getByRole('button', { name: 'Continue as Guest' }).click();

    expect(onContinueAsGuest).toHaveBeenCalledTimes(1);
  });

  it('should show the guest button loading and disabled when a guest attempt is pending', async () => {
    const screen = await render(splash('pending'));

    const guest = screen.getByRole('button', { name: 'Continue as Guest' });
    await expect.element(guest).toBeDisabled();
    await expect.element(guest).toHaveClass('p-button-loading');
    await expect.element(screen.getByRole('link', { name: 'Login with ORCID' })).toBeVisible();
  });

  it('should give focus back to the guest button when a guest attempt fails', async () => {
    const screen = await render(splash('pending'));
    const guest = screen.getByRole('button', { name: 'Continue as Guest' });
    await expect.element(guest).toBeDisabled();

    await screen.rerender(splash('failed'));

    await expect.element(guest).toBeEnabled();
    await expect.element(guest).toHaveFocus();
  });
});
