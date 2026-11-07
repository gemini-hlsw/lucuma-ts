import { fakeJwt, standardUser } from '@gemini-hlsw/lucuma-common-ui/testing';
import { describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import NightPage from '@/app/pages/NightPage';
import { setLastSite } from '@/app/useLastSite';
import { SessionGateContainer } from '@/auth/SessionGateContainer';
import { signInUrl } from '@/auth/ssoClient';
import { odbTokenAtom, sessionCheckedAtom, setToken } from '@/components/atoms/auth';
import { nightAxisLabels } from '@/test/chartProbe';
import { nightSchedule } from '@/test/fixtures/night';
import { chooseClock, chooseSite, clockChoice, openAppMenu } from '@/test/helpers';
import { renderInShell, renderWithRoute } from '@/test/render';
import { stubSso } from '@/test/sso';

import { NavbarContainer } from './NavbarContainer';

type Session = [[typeof odbTokenAtom, string | null], [typeof sessionCheckedAtom, boolean]];
const session = (token: string | null = null, checked = true): Session => [
  [odbTokenAtom, token],
  [sessionCheckedAtom, checked],
];

/** A function, so each token's `exp` counts from the moment the test asks for it. */
const staffToken = () => fakeJwt(standardUser('staff'));
const guestToken = () => fakeJwt({ type: 'guest', id: 'u-2' });

/** The gate mounts the masthead only with a session, so the default reader is a signed-in person. */
const renderNavbar = async (route = '/') =>
  renderWithRoute(<NavbarContainer />, { route, initialValues: session(staffToken()) });

const renderAsGuest = async () =>
  renderWithRoute(<NavbarContainer />, { route: '/', initialValues: session(guestToken()) });

const NIGHT = '2026-11-14';

/** The night page inside the real shell: the subject is the clock its chart axis prints. */
const NIGHT_SCHEDULE = nightSchedule({ site: 'GS', night: NIGHT });

const openNightInShell = async () =>
  renderInShell(<NightPage />, { route: `/night?site=GS&night=${NIGHT}`, mocks: [NIGHT_SCHEDULE] });

describe(NavbarContainer, () => {
  it('should link the wordmark to tonight, dropping the night, page state and clock, when the reader is deep-linked', async () => {
    const screen = await renderNavbar('/semester?site=GS&night=2026-11-14&q=GPI');
    await chooseClock(screen, 'UTC');

    const brand = screen.getByRole('link', { name: 'Resource', exact: false });
    await expect.element(brand).toHaveAttribute('href', '/night?site=GS');
  });

  it('should remember the site, so the next visit opens where the reader works, when a site is chosen', async () => {
    const first = await renderNavbar('/night');
    await expect.element(first.getByRole('button', { name: 'Gemini North' })).toHaveAttribute('aria-pressed', 'true');

    await chooseSite(first, 'GS');
    await expect.poll(() => first.router.location.search).toContain('site=GS');
    await first.unmount();

    const second = await renderNavbar('/night');

    await expect.element(second.getByRole('button', { name: 'Gemini South' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('should write the site it resolved into the URL, so Back and a copied link both carry it, when it renders', async () => {
    const screen = await renderNavbar('/night');

    await expect.poll(() => screen.router.location.search).toBe('?site=GN');
    expect(screen.router.navigationType).toBe('REPLACE');

    await chooseSite(screen, 'GS');
    await expect.poll(() => screen.router.location.search).toBe('?site=GS');

    await screen.router.navigate(-1);
    await expect.poll(() => screen.router.location.search).toBe('?site=GN');
    await expect.element(screen.getByRole('button', { name: 'Gemini North' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('should correct the site rather than render one and say another when the URL names a site it cannot mean', async () => {
    const screen = await renderNavbar('/night?site=gs');

    await expect.poll(() => screen.router.location.search).toBe('?site=GN');
    await expect.element(screen.getByRole('button', { name: 'Gemini North' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('should let a shared link override the remembered site, since the URL is the view, when the two differ', async () => {
    setLastSite('GS');
    const screen = await renderNavbar('/night?site=GN');

    await expect.element(screen.getByRole('button', { name: 'Gemini North' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('should offer the clock in the menu, defaulting to the site clock, when the menu opens', async () => {
    const screen = await renderNavbar();
    await openAppMenu(screen);
    await expect.element(clockChoice('Site time')).toHaveAttribute('aria-checked', 'true');
    await expect.element(clockChoice('UTC')).toHaveAttribute('aria-checked', 'false');
  });

  it('should switch every clock in the app to UT when UT is chosen', async () => {
    const screen = await openNightInShell();
    await expect.poll(() => nightAxisLabels()[0]).toBe('14:00');

    await chooseClock(screen, 'UTC');
    await expect.poll(() => nightAxisLabels()[0]).toBe('18:00');
  });

  it('should switch the clock, the row being the whole control, when it is chosen from the keyboard', async () => {
    const screen = await openNightInShell();
    await expect.poll(() => nightAxisLabels()[0]).toBe('14:00');

    await openAppMenu(screen);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    await expect.poll(() => nightAxisLabels()[0]).toBe('18:00');
  });

  it('should operate the clock, which is why the spike kept menu-native navigation, when driven from the keyboard', async () => {
    const screen = await openNightInShell();
    await expect.poll(() => nightAxisLabels()[0]).toBe('14:00');

    await openAppMenu(screen);
    const utc = clockChoice('UTC');
    const menuList = () => document.querySelector('ul[role="menu"]');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(menuList()?.getAttribute('aria-activedescendant')).toBe(utc.element().id);

    await userEvent.keyboard('{Enter}');

    await expect.poll(() => nightAxisLabels()[0]).toBe('18:00');
    await openAppMenu(screen);
    await expect.element(clockChoice('UTC')).toHaveAttribute('aria-checked', 'true');
  });

  it('should remember the clock, which is what a habit means, when the navbar remounts', async () => {
    const first = await renderNavbar();
    await chooseClock(first, 'UTC');
    await first.unmount();

    const second = await renderNavbar();
    await openAppMenu(second);

    await expect.element(clockChoice('UTC')).toHaveAttribute('aria-checked', 'true');
  });

  it.each([
    ['a guest', guestToken, 'Guest User'],
    ['a person', staffToken, 'Ada Lovelace'],
  ])(
    'should name the reader from the token, in the control and its title, when %s is signed in',
    async (_who, token, name) => {
      const screen = await renderWithRoute(<NavbarContainer />, { route: '/', initialValues: session(token()) });

      const account = screen.getByTestId('account-control');
      await expect.element(account).toHaveTextContent(name);
      await expect.poll(() => account.element().getAttribute('title')).toBe(name);
    },
  );

  it('should offer the ORCID login, since a guest session is a place to sign in from, when a guest is signed in', async () => {
    const screen = await renderAsGuest();

    await openAppMenu(screen);

    await expect.element(page.getByRole('menuitem', { name: 'Login with ORCID' })).toBeVisible();
  });

  it('should sign out before SSO answers, leaving the reader on the splash until the next sign-in, when Logout is pressed', async () => {
    stubSso();
    const screen = await renderWithRoute(
      <SessionGateContainer>
        <NavbarContainer />
      </SessionGateContainer>,
      { route: '/', initialValues: session(staffToken()) },
    );
    await openAppMenu(screen);
    await page.getByRole('menuitem', { name: 'Logout' }).click();

    await expect.element(screen.getByRole('heading', { level: 1, name: 'Sign in to read the schedule' })).toBeVisible();
    expect(screen.getByTestId('account-control').query()).toBeNull();

    setToken(screen.store, staffToken());

    await expect.element(screen.getByTestId('account-control')).toHaveTextContent('Ada Lovelace');
    await openAppMenu(screen);
    await expect.element(page.getByRole('menuitem', { name: 'Logout' })).toBeVisible();
  });

  it('should show no role anywhere in the masthead or the menu when the menu is open', async () => {
    const screen = await renderNavbar();

    await openAppMenu(screen);

    const shown = [screen.getByRole('banner').element(), page.getByRole('menu').element()].map(
      (element) => element.textContent ?? '',
    );
    expect(shown.join(' ').toLowerCase()).not.toContain('staff');
  });

  it('should send the login return address to the page actually open, not a fixed default, when ORCID login is offered', async () => {
    const original = window.location.href;
    try {
      history.pushState(null, '', '/night?site=GS&night=2026-11-14');
      const first = await renderAsGuest();
      await openAppMenu(first);
      const firstExpected = signInUrl();
      await expect.element(page.getByRole('link', { name: 'Login with ORCID' })).toHaveAttribute('href', firstExpected);
      await first.unmount();

      history.pushState(null, '', '/semester?site=GN');
      const second = await renderAsGuest();
      await openAppMenu(second);
      const secondExpected = signInUrl();

      expect(secondExpected).not.toBe(firstExpected);
      await expect
        .element(page.getByRole('link', { name: 'Login with ORCID' }))
        .toHaveAttribute('href', secondExpected);
    } finally {
      history.pushState(null, '', original);
    }
  });
});
