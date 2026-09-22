import { afterEach, describe, expect, it, vi } from 'vitest';
import { type LocatorSelectors, page, userEvent } from 'vitest/browser';

import { CURRENT_ENV } from '@/app/environment';
import NightPage from '@/app/pages/NightPage';
import { setLastSite } from '@/app/useLastSite';
import { signInUrl } from '@/auth/ssoClient';
import { setToken } from '@/components/atoms/auth';
import { fakeJwt, namedUser, standardUser } from '@/test/factories';
import { chooseClock, chooseSite, openAppMenu } from '@/test/helpers';
import { renderApp } from '@/test/renderApp';
import { ssoCall, stubSso } from '@/test/sso';

import Layout from './Layout';
import Navbar from './Navbar';

const renderNavbar = async (route = '/') => renderApp({ element: <Navbar />, route });

const SSO_UNREACHABLE_NOTE = 'Logout did not reach SSO. Close the browser to end the session.';
const MENU_OWNABLE = ['menuitem', 'menuitemradio', 'menuitemcheckbox', 'group', 'separator'];
const MENU_FORBIDDEN = ['[role="status"]', '[role="alert"]', '[role="log"]', '[role="none"]', '[aria-live]'];
const renderSignedIn = async () =>
  renderApp({ element: <Navbar />, route: '/', token: fakeJwt(standardUser('staff')) });

/** PrimeReact binds its outside-click listener only when the enter transition ends, which this class marks. */
const settleOverlay = async (): Promise<void> => {
  const overlay = () => page.getByRole('menu').element().closest('.p-menu');
  await expect.poll(() => overlay()?.classList.contains('p-connected-overlay-enter-done')).toBe(true);
};

const MENU_CLOSERS: readonly [string, (screen: LocatorSelectors) => Promise<void>][] = [
  ['Escape', () => userEvent.keyboard('{Escape}')],
  ['a click outside', (screen) => userEvent.click(screen.getByTestId('account-control'))],
  ['choosing an item', () => page.getByRole('menuitemradio', { name: 'Clock: UTC', exact: true }).click()],
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe(Navbar, () => {
  it('renders the Resource wordmark', async () => {
    const screen = await renderNavbar();

    await expect.element(screen.getByText('Resource')).toBeVisible();
  });

  it('links the wordmark to tonight, dropping the deep-linked night', async () => {
    const screen = await renderNavbar('/semester?site=GS&night=2026-11-14&view=calendar');

    const brand = screen.getByRole('link', { name: 'Resource', exact: false });
    await expect.element(brand).toHaveAttribute('href', '/night?site=GS');
  });

  it('carries the site beside the wordmark, announcing the telescope behind the code', async () => {
    const screen = await renderNavbar('/night?site=GS');

    await expect.element(screen.getByRole('group', { name: 'Site' })).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Gemini South' })).toHaveAttribute('aria-pressed', 'true');
    await expect.element(screen.getByRole('button', { name: 'Gemini North' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('remembers the site chosen, so the next visit opens where the reader works', async () => {
    const first = await renderNavbar('/night');
    await expect.element(first.getByRole('button', { name: 'Gemini North' })).toHaveAttribute('aria-pressed', 'true');

    await chooseSite(first, 'GS');
    await expect.poll(() => first.router.state.location.search).toContain('site=GS');
    await first.unmount();

    const second = await renderNavbar('/night');

    await expect.element(second.getByRole('button', { name: 'Gemini South' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('writes the site it resolved into the URL, so Back and a copied link both carry it', async () => {
    const screen = await renderNavbar('/night');

    await expect.poll(() => screen.router.state.location.search).toBe('?site=GN');
    expect(screen.router.state.historyAction).toBe('REPLACE');

    await chooseSite(screen, 'GS');
    await expect.poll(() => screen.router.state.location.search).toBe('?site=GS');

    await screen.router.navigate(-1);
    await expect.poll(() => screen.router.state.location.search).toBe('?site=GN');
    await expect.element(screen.getByRole('button', { name: 'Gemini North' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('corrects a site the URL names but cannot mean, rather than rendering one and saying another', async () => {
    const screen = await renderNavbar('/night?site=gs');

    await expect.poll(() => screen.router.state.location.search).toBe('?site=GN');
    await expect.element(screen.getByRole('button', { name: 'Gemini North' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('lets a shared link override the remembered site - the URL is the view', async () => {
    setLastSite('GS');
    const screen = await renderNavbar('/night?site=GN');

    await expect.element(screen.getByRole('button', { name: 'Gemini North' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('offers no semester control - the semester belongs to its own page', async () => {
    const screen = await renderNavbar('/night?site=GS&semester=2026B');

    await expect.element(screen.getByLabelText('Semester', { exact: true })).not.toBeInTheDocument();
  });

  it('exposes both menu headers as named groups, not as stripped presentation rows', async () => {
    const screen = await renderNavbar();

    await openAppMenu(screen);
    for (const heading of ['Not signed in', 'Clock']) {
      await expect.element(page.getByRole('group').getByText(heading, { exact: true })).toBeVisible();
    }
  });

  it('keeps one interactive element per clock row, so the row is the whole control', async () => {
    const screen = await renderNavbar();

    await openAppMenu(screen);

    const radio = page.getByRole('menuitemradio', { name: 'Clock: UTC', exact: true }).element();
    expect(radio.querySelectorAll('a[href], button, input, [tabindex]:not([tabindex="-1"])')).toHaveLength(0);
  });

  it('takes Enter on the site control, the way every button does', async () => {
    const screen = await renderNavbar('/night?site=GS');

    screen.getByRole('button', { name: 'Gemini North' }).element().focus();
    await userEvent.keyboard('{Enter}');

    await expect.poll(() => screen.router.state.location.search).toContain('site=GN');
  });

  it('offers no way to choose a backend - there is one, and it is not a setting', async () => {
    const screen = await renderNavbar();

    await expect.element(screen.getByLabelText('Site', { exact: true })).toBeInTheDocument();
    await expect.element(screen.getByLabelText('Data', { exact: true })).not.toBeInTheDocument();
  });

  it('offers the clock in the menu, defaulting to the site clock', async () => {
    const screen = await renderNavbar();
    await openAppMenu(screen);
    await expect
      .element(page.getByRole('menuitemradio', { name: 'Clock: Site time', exact: true }))
      .toHaveAttribute('aria-checked', 'true');
    await expect
      .element(page.getByRole('menuitemradio', { name: 'Clock: UTC', exact: true }))
      .toHaveAttribute('aria-checked', 'false');
  });

  it('keeps the clock out of the bar - it is a habit, not a selection', async () => {
    const screen = await renderNavbar();

    await expect.element(screen.getByRole('group', { name: 'Clock' })).not.toBeInTheDocument();
  });

  it('switches every clock in the app to UT', async () => {
    const screen = await renderApp({
      element: <Layout />,
      route: '/night?site=GS&night=2026-11-14',
      path: '/',
      childRoutes: [{ path: 'night', element: <NightPage /> }],
    });
    await expect.element(screen.getByText('14:00 to 14:00 site time', { exact: false })).toBeVisible();

    await chooseClock(screen, 'UTC');
    await expect.element(screen.getByText('17:00 to 17:00 UTC', { exact: false })).toBeVisible();
  });

  it('switches the clock from the keyboard, the row being the whole control', async () => {
    const screen = await renderApp({
      element: <Layout />,
      route: '/night?site=GS&night=2026-11-14',
      path: '/',
      childRoutes: [{ path: 'night', element: <NightPage /> }],
    });
    await expect.element(screen.getByText('14:00 to 14:00 site time', { exact: false })).toBeVisible();

    await openAppMenu(screen);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    await expect.element(screen.getByText('17:00 to 17:00 UTC', { exact: false })).toBeVisible();
  });

  it('operates the clock from the keyboard - the spike kept menu-native navigation for exactly this', async () => {
    const screen = await renderApp({
      element: <Layout />,
      route: '/night?site=GS&night=2026-11-14',
      path: '/',
      childRoutes: [{ path: 'night', element: <NightPage /> }],
    });
    await expect.element(screen.getByText('14:00 to 14:00 site time', { exact: false })).toBeVisible();

    await openAppMenu(screen);
    const utc = page.getByRole('menuitemradio', { name: 'Clock: UTC', exact: true });
    const menuList = () => document.querySelector('ul[role="menu"]');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(menuList()?.getAttribute('aria-activedescendant')).toBe(utc.element().id);

    await userEvent.keyboard('{Enter}');

    await expect.element(screen.getByText('17:00 to 17:00 UTC', { exact: false })).toBeVisible();
    await openAppMenu(screen);
    await expect
      .element(page.getByRole('menuitemradio', { name: 'Clock: UTC', exact: true }))
      .toHaveAttribute('aria-checked', 'true');
  });

  it('leaves the clock out of the way home - the browser remembers it, the link does not', async () => {
    const screen = await renderNavbar('/semester?site=GS&night=2026-11-14');

    const brand = screen.getByRole('link', { name: 'Resource', exact: false });
    await expect.element(brand).toHaveAttribute('href', '/night?site=GS');
  });

  it('remembers the clock across a remount, which is what a habit means', async () => {
    const first = await renderNavbar();
    await chooseClock(first, 'UTC');
    await first.unmount();

    const second = await renderNavbar();
    await openAppMenu(second);

    await expect
      .element(page.getByRole('menuitemradio', { name: 'Clock: UTC', exact: true }))
      .toHaveAttribute('aria-checked', 'true');
  });

  it('carries no environment badge - the banner above the shell says it instead', async () => {
    const screen = await renderNavbar();

    await expect.element(screen.getByTestId('env-marker')).not.toBeInTheDocument();
  });

  it('opens About Resource from the hamburger menu, naming the running build', async () => {
    const screen = await renderNavbar('/night?site=GS');

    await screen.getByRole('button', { name: 'Menu' }).click();
    const about = page.getByText('About Resource');
    await expect.element(about).toBeVisible();
    await about.click();

    const dialog = page.getByTestId('about-resource');
    await expect.element(dialog).toBeVisible();
    await expect.element(dialog.getByText(new RegExp(`.+-${CURRENT_ENV.versionSuffix}$`, 'u'))).toBeVisible();
    await expect.element(dialog.getByText('/resource/graphql', { exact: false })).toBeVisible();

    await userEvent.keyboard('{Escape}');
    await expect.element(dialog).not.toBeInTheDocument();
  });

  it('hands focus back to the menu button when About is dismissed from the keyboard', async () => {
    const screen = await renderNavbar('/night?site=GS');
    const menuButton = screen.getByRole('button', { name: 'Menu' }).element() as HTMLElement;

    menuButton.focus();
    await userEvent.keyboard('{Enter}');
    await expect.element(page.getByRole('menuitem', { name: 'About Resource' })).toBeVisible();
    await userEvent.keyboard('{Enter}');
    await expect.element(page.getByTestId('about-resource')).toBeVisible();

    await userEvent.keyboard('{Escape}');

    await expect.element(page.getByTestId('about-resource')).not.toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(menuButton);
  });

  it('hands focus back to the menu button when About is closed by its own button', async () => {
    const screen = await renderNavbar('/night?site=GS');
    const menuButton = screen.getByRole('button', { name: 'Menu' }).element() as HTMLElement;

    await openAppMenu(screen);
    await page.getByRole('menuitem', { name: 'About Resource' }).click();
    await expect.element(page.getByTestId('about-resource')).toBeVisible();

    await page.getByRole('button', { name: 'Close' }).click();

    await expect.element(page.getByTestId('about-resource')).not.toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(menuButton);
  });

  it('says nobody is signed in, and offers the ORCID login as a link the browser follows', async () => {
    const screen = await renderNavbar();

    const account = screen.getByTestId('account-control');
    await expect.element(account).toHaveTextContent('Not signed in');
    await expect.element(account).not.toHaveAttribute('title');

    await openAppMenu(screen);

    await expect.element(page.getByRole('menu').getByText('Not signed in', { exact: true })).toBeVisible();
    await expect.element(page.getByRole('link', { name: 'Login with ORCID' })).toHaveAttribute('href', signInUrl());
    const logo = page.getByRole('menuitem', { name: 'Login with ORCID' }).element().querySelector('svg.fa-orcid');
    expect(logo).not.toBeNull();
    expect(logo!.getAttribute('aria-hidden')).toBe('true');
    await expect.element(page.getByRole('menuitem', { name: 'Login with ORCID' })).not.toHaveAttribute('aria-disabled');
    await expect.element(page.getByRole('menuitem', { name: 'Logout' })).not.toBeInTheDocument();
  });

  it('closes the menu on a click outside it, and the click takes focus with it', async () => {
    const screen = await renderNavbar();
    const menuButton = screen.getByRole('button', { name: 'Menu' }).element();

    await openAppMenu(screen);
    await settleOverlay();
    await userEvent.click(screen.getByTestId('account-control'));

    await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
    expect(document.activeElement?.closest('[role="menu"]') ?? null).toBeNull();
    expect(document.activeElement).not.toBe(menuButton);
  });

  it.each([['{Tab}'], ['{Shift>}{Tab}{/Shift}']])(
    'closes the menu on %s and hands focus back to the button, so the tab sequence continues from it',
    async (keys) => {
      const screen = await renderApp({ element: <Layout />, route: '/night?site=GS' });
      const menuButton = screen.getByRole('button', { name: 'Menu' }).element();

      await openAppMenu(screen);
      await expect.poll(() => document.activeElement?.getAttribute('role')).toBe('menu');
      await userEvent.keyboard(keys);

      await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
      await expect.poll(() => document.activeElement).toBe(menuButton);
    },
  );

  it.each(MENU_CLOSERS)(
    'tells assistive technology the menu is open and which list the button controls, until %s closes it',
    async (_how, close) => {
      const screen = await renderNavbar();
      const menuButton = screen.getByRole('button', { name: 'Menu' });

      await expect.element(menuButton).toHaveAttribute('aria-expanded', 'false');
      await expect.element(menuButton).not.toHaveAttribute('aria-controls');

      await openAppMenu(screen);
      await settleOverlay();
      await expect.element(menuButton).toHaveAttribute('aria-expanded', 'true');
      expect(menuButton.element().getAttribute('aria-controls')).toBe(page.getByRole('menu').element().id);

      await close(screen);
      await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
      await expect.element(menuButton).toHaveAttribute('aria-expanded', 'false');
      await expect.element(menuButton).not.toHaveAttribute('aria-controls');
    },
  );

  it('names the list that carries the menu role, not the wrapper around it', async () => {
    const screen = await renderNavbar();

    await openAppMenu(screen);

    await expect.element(page.getByRole('menu', { name: 'Application menu' })).toBeVisible();
  });

  it('reads About first and the account block last, the order Explore uses', async () => {
    const screen = await renderNavbar();

    await openAppMenu(screen);

    const rows = [...page.getByRole('menu').element().children].map((row) => row.textContent?.trim() ?? '');
    expect(rows).toEqual(['About Resource', 'Clock', 'Site time', 'UTC', '', 'Not signed in', 'Login with ORCID']);
  });

  it.each([
    ['signed out', { token: null }, 'Login with ORCID'],
    ['signed in', { token: fakeJwt(standardUser('staff')) }, 'Logout'],
    ['checking', { sessionChecked: false }, null],
  ])('offers only the auth item that applies when %s', async (_state, options, expected) => {
    const screen = await renderApp({ element: <Navbar />, route: '/', ...options });

    await openAppMenu(screen);

    const offered = ['Login with ORCID', 'Logout'].filter(
      (label) => page.getByRole('menuitem', { name: label }).elements().length > 0,
    );
    expect(offered).toEqual(expected === null ? [] : [expected]);
  });

  it('claims neither state while the first refresh is still out', async () => {
    const screen = await renderApp({ element: <Navbar />, route: '/', sessionChecked: false });

    await expect.element(screen.getByText('Checking sign-in')).toBeInTheDocument();
    await expect.element(screen.getByTestId('account-control')).not.toHaveAttribute('title');

    await openAppMenu(screen);

    await expect.element(page.getByRole('menuitem', { name: 'Login with ORCID' })).not.toBeInTheDocument();
    await expect.element(page.getByRole('menuitem', { name: 'Logout' })).not.toBeInTheDocument();
  });

  it('names the signed-in reader in the bar and at the head of the menu', async () => {
    const screen = await renderApp({ element: <Navbar />, route: '/', token: fakeJwt(standardUser('staff')) });

    await expect.element(screen.getByTestId('account-control')).toHaveTextContent('Ada Lovelace');

    await openAppMenu(screen);

    await expect.element(page.getByRole('menu').getByText('Ada Lovelace', { exact: true })).toBeVisible();
    await expect.element(page.getByRole('menuitem', { name: 'Logout' })).toBeVisible();
    await expect.element(page.getByRole('menuitem', { name: 'Login with ORCID' })).not.toBeInTheDocument();
  });

  it('keeps a long name whole in the title, the bar showing only what fits', async () => {
    const longName = 'Bartholomew Fitzwilliams Oyelaran-Smythe';
    const screen = await renderApp({ element: <Navbar />, route: '/', token: fakeJwt(namedUser(longName)) });

    await expect.element(screen.getByTestId('account-control')).toHaveAttribute('title', longName);
  });

  it('signs out before SSO answers, announces it, and hands focus back to the menu button', async () => {
    stubSso();
    const screen = await renderSignedIn();

    await openAppMenu(screen);
    await page.getByRole('menuitem', { name: 'Logout' }).click();
    await expect.element(screen.getByTestId('account-control')).toHaveTextContent('Not signed in');
    await expect.element(screen.getByRole('status')).toHaveTextContent('Logged out');
    const menuButton = screen.getByRole('button', { name: 'Menu' }).element();
    await expect.poll(() => document.activeElement).toBe(menuButton);

    ssoCall(0).answer({ status: 200 });
    await openAppMenu(screen);
    await expect.element(page.getByRole('menu').getByText(SSO_UNREACHABLE_NOTE)).not.toBeInTheDocument();
    expect(screen.getByRole('status').element().textContent).toBe('Logged out');
  });

  it('says the cookie may still stand when the logout never reached SSO, until the next sign-in', async () => {
    stubSso();
    const screen = await renderSignedIn();

    await openAppMenu(screen);
    await page.getByRole('menuitem', { name: 'Logout' }).click();
    await expect.poll(() => screen.getByRole('status').element().textContent).toBe('Logged out');

    ssoCall(0).fail();
    await expect.poll(() => screen.getByRole('status').element().textContent).toBe(SSO_UNREACHABLE_NOTE);

    await openAppMenu(screen);
    await expect.element(page.getByRole('menu').getByText(SSO_UNREACHABLE_NOTE)).toBeVisible();
    await expect.element(screen.getByTestId('account-control')).toHaveTextContent('Not signed in');

    setToken(screen.store, fakeJwt(standardUser('staff')));

    await expect.element(page.getByRole('menu').getByText(SSO_UNREACHABLE_NOTE)).not.toBeInTheDocument();
  });

  it('keeps every row of the menu to what `role="menu"` may own, at every depth', async () => {
    stubSso();
    const screen = await renderSignedIn();

    await openAppMenu(screen);
    await page.getByRole('menuitem', { name: 'Logout' }).click();
    ssoCall(0).fail();

    await openAppMenu(screen);
    const menu = page.getByRole('menu').element();
    await expect.element(page.getByRole('menu').getByText(SSO_UNREACHABLE_NOTE)).toBeVisible();

    const rows = [...menu.children];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(MENU_OWNABLE).toContain(row.getAttribute('role'));
    }
    expect([...menu.querySelectorAll(MENU_FORBIDDEN.join(', '))]).toHaveLength(0);
  });

  it('reads an expired token as signed out, even though the user still decodes', async () => {
    const screen = await renderApp({ element: <Navbar />, route: '/', token: fakeJwt(standardUser('staff'), -60) });

    const account = screen.getByTestId('account-control');
    await expect.element(account).toHaveTextContent('Not signed in');
    await expect.element(account).not.toHaveAttribute('title');

    await openAppMenu(screen);

    await expect.element(page.getByRole('menu').getByText('Not signed in', { exact: true })).toBeVisible();
    await expect.element(page.getByRole('menuitem', { name: 'Login with ORCID' })).toBeVisible();
    await expect.element(page.getByRole('menuitem', { name: 'Logout' })).not.toBeInTheDocument();
  });

  it('re-announces sign-out and re-decides the unreachable note after a fresh sign-in', async () => {
    stubSso();
    const screen = await renderSignedIn();

    await openAppMenu(screen);
    await page.getByRole('menuitem', { name: 'Logout' }).click();
    await expect.element(screen.getByRole('status')).toHaveTextContent('Logged out');
    ssoCall(0).answer({ status: 200 });

    await openAppMenu(screen);
    await expect.element(page.getByRole('menu').getByText(SSO_UNREACHABLE_NOTE)).not.toBeInTheDocument();

    setToken(screen.store, fakeJwt(standardUser('staff')));
    await expect.element(screen.getByTestId('account-control')).toHaveTextContent('Ada Lovelace');
    await expect.element(screen.getByRole('status')).toHaveTextContent('');

    await expect.element(page.getByRole('menuitem', { name: 'Logout' })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Logout' }).click();

    await expect.element(screen.getByTestId('account-control')).toHaveTextContent('Not signed in');
    await expect.element(screen.getByRole('status')).toHaveTextContent('Logged out');
    ssoCall(1).fail();

    await openAppMenu(screen);
    await expect.element(page.getByRole('menu').getByText(SSO_UNREACHABLE_NOTE)).toBeVisible();
  });

  it('sends the login return address to the page actually open, not a fixed default', async () => {
    const original = window.location.href;
    try {
      history.pushState(null, '', '/night?site=GS&night=2026-11-14');
      const first = await renderNavbar();
      await openAppMenu(first);
      const firstExpected = signInUrl();
      await expect.element(page.getByRole('link', { name: 'Login with ORCID' })).toHaveAttribute('href', firstExpected);
      await first.unmount();

      history.pushState(null, '', '/semester?site=GN');
      const second = await renderNavbar();
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
