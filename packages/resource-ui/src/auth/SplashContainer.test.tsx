import { fakeJwt } from '@gemini-hlsw/lucuma-common-ui/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { odbTokenAtom } from '@/components/atoms/auth';
import { ToastOutlet } from '@/components/ui/ToastOutlet';
import { toastNamed } from '@/test/helpers';
import { renderWithContext } from '@/test/render';
import { type PendingSsoCall, ssoCalls, stubSso } from '@/test/sso';

import { GUEST_FAILED, SplashContainer } from './SplashContainer';
import { signInUrl } from './ssoClient';

const GUEST_PATH = '/api/v1/auth-as-guest';
const guestCalls = () => ssoCalls().filter((made) => made.url.includes(GUEST_PATH));
const guestInits = () =>
  vi
    .mocked(fetch)
    .mock.calls.filter(([url]) => (url as URL).toString().includes(GUEST_PATH))
    .map(([, init]) => init);

const GUEST_TOKEN = fakeJwt({ type: 'guest', id: 'u-guest' });

const openSplash = () =>
  renderWithContext(
    <>
      <SplashContainer />
      <ToastOutlet />
    </>,
  );

beforeEach(() => {
  stubSso();
});

describe(SplashContainer, () => {
  it('should link ORCID sign-in back to this page when the splash renders', async () => {
    const screen = await openSplash();

    const orcid = screen.getByRole('link', { name: 'Login with ORCID' });
    await expect.element(orcid).toHaveAttribute('href', signInUrl());
    expect(new URL(orcid.element().getAttribute('href') ?? '').searchParams.get('state')).toBe(window.location.href);
  });

  it('should sign the guest in with one credentialed call and keep the token it answers when guest is pressed', async () => {
    const screen = await openSplash();

    await screen.getByRole('button', { name: 'Continue as Guest' }).click();

    await expect.poll(guestCalls).toHaveLength(1);
    expect(guestInits()).toEqual([expect.objectContaining({ method: 'POST', credentials: 'include' })]);
    expect(screen.store.get(odbTokenAtom)).toBeNull();
    guestCalls()[0]?.answer({ body: GUEST_TOKEN });

    await expect.poll(() => screen.store.get(odbTokenAtom)).toBe(GUEST_TOKEN);
    expect(guestCalls()).toHaveLength(1);
  });

  it.each([
    ['a non-2xx answer', (call: PendingSsoCall) => call.answer({ status: 500 })],
    ['an empty body', (call: PendingSsoCall) => call.answer({ body: '' })],
    ['a network failure', (call: PendingSsoCall) => call.fail()],
  ])(
    'should say guest sign-in failed and keep the splash with both buttons live when the guest call ends in %s',
    async (_, settle) => {
      const screen = await openSplash();
      await screen.getByRole('button', { name: 'Continue as Guest' }).click();
      await expect.poll(guestCalls).toHaveLength(1);

      settle(guestCalls()[0]!);

      await expect.element(toastNamed(GUEST_FAILED)).toBeVisible();
      await expect.element(toastNamed(GUEST_FAILED)).toHaveClass('p-toast-message-error');
      expect(toastNamed(GUEST_FAILED).element().querySelector('.p-toast-detail')?.textContent ?? '').toBe('');
      await expect
        .element(screen.getByRole('heading', { level: 1, name: 'Sign in to read the schedule' }))
        .toBeVisible();
      await expect.element(screen.getByRole('button', { name: 'Continue as Guest' })).toBeEnabled();
      await expect.element(screen.getByRole('link', { name: 'Login with ORCID' })).toBeVisible();
      expect(screen.store.get(odbTokenAtom)).toBeNull();
      expect(guestCalls()).toHaveLength(1);
    },
  );

  it('should send a fresh guest call and sign in on its answer when guest is pressed again after a failure', async () => {
    const screen = await openSplash();
    await screen.getByRole('button', { name: 'Continue as Guest' }).click();
    await expect.poll(guestCalls).toHaveLength(1);
    guestCalls()[0]?.fail();
    await expect.element(toastNamed(GUEST_FAILED)).toBeVisible();

    await screen.getByRole('button', { name: 'Continue as Guest' }).click();

    await expect.poll(guestCalls).toHaveLength(2);
    await expect.element(screen.getByRole('button', { name: 'Continue as Guest' })).toBeDisabled();
    guestCalls()[1]?.answer({ body: GUEST_TOKEN });

    await expect.poll(() => screen.store.get(odbTokenAtom)).toBe(GUEST_TOKEN);
  });
});
