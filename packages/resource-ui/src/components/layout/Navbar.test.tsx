import { VERSION_SUFFIX } from '@gemini-hlsw/lucuma-common-ui';
import { fakeJwt, standardUser } from '@gemini-hlsw/lucuma-common-ui/testing';
import { describe, expect, it } from 'vitest';
import { type LocatorSelectors, page, userEvent } from 'vitest/browser';

import { CURRENT_ENV } from '@/app/environment';
import NightPage from '@/app/pages/NightPage';
import { setLastSite } from '@/app/useLastSite';
import orcidLogo from '@/assets/orcid-logo.svg';
import { signInUrl } from '@/auth/ssoClient';
import { odbTokenAtom, sessionCheckedAtom, setToken } from '@/components/atoms/auth';
import { nightAxisLabels } from '@/test/chartProbe';
import { nightSchedule } from '@/test/fixtures/night';
import { chooseClock, chooseSite, clockChoice, openAppMenu } from '@/test/helpers';
import { renderInShell, renderWithRoute } from '@/test/render';
import { stubSso } from '@/test/sso';

import Layout from './Layout';
import { Navbar } from './Navbar';

type Session = [[typeof odbTokenAtom, string | null], [typeof sessionCheckedAtom, boolean]];
const session = (token: string | null = null, checked = true): Session => [
  [odbTokenAtom, token],
  [sessionCheckedAtom, checked],
];

/** A function, so each token's `exp` counts from the moment the test asks for it. */
const staffToken = () => fakeJwt(standardUser('staff'));

const renderNavbar = async (route = '/') => renderWithRoute(<Navbar />, { route, initialValues: session() });

const renderSignedIn = async () => renderWithRoute(<Navbar />, { route: '/', initialValues: session(staffToken()) });

const NIGHT = '2026-11-14';

/** The night page inside the real shell: the subject is the clock its chart axis prints. */
const NIGHT_SCHEDULE = nightSchedule({ site: 'GS', night: NIGHT });

const openNightInShell = async () =>
  renderInShell(<NightPage />, { route: `/night?site=GS&night=${NIGHT}`, mocks: [NIGHT_SCHEDULE] });

const MENU_OWNABLE = ['menuitem', 'menuitemradio', 'menuitemcheckbox', 'group', 'separator'];
const MENU_FORBIDDEN = ['[role="status"]', '[role="alert"]', '[role="log"]', '[role="none"]', '[aria-live]'];

/** PrimeReact binds its outside-click listener only when the enter transition ends, which this class marks. */
const settleOverlay = async (): Promise<void> => {
  const overlay = () => page.getByRole('menu').element().closest('.p-menu');
  await expect.poll(() => overlay()?.classList.contains('p-connected-overlay-enter-done')).toBe(true);
};

const MENU_CLOSERS: readonly [string, (screen: LocatorSelectors) => Promise<void>][] = [
  ['Escape', () => userEvent.keyboard('{Escape}')],
  ['a click outside', (screen) => userEvent.click(screen.getByTestId('account-control'))],
  ['choosing an item', () => clockChoice('UTC').click()],
];

describe(Navbar, () => {
  it('should render the Resource wordmark when it mounts', async () => {
    const screen = await renderNavbar();

    await expect.element(screen.getByText('Resource')).toBeVisible();
  });

  it('should link the wordmark to tonight, dropping the night, page state and clock, when the reader is deep-linked', async () => {
    const screen = await renderNavbar('/semester?site=GS&night=2026-11-14&q=GPI');
    await chooseClock(screen, 'UTC');

    const brand = screen.getByRole('link', { name: 'Resource', exact: false });
    await expect.element(brand).toHaveAttribute('href', '/night?site=GS');
  });

  it('should carry the site beside the wordmark, announcing the telescope behind the code, when it mounts', async () => {
    const screen = await renderNavbar('/night?site=GS');

    await expect.element(screen.getByRole('group', { name: 'Site' })).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Gemini South' })).toHaveAttribute('aria-pressed', 'true');
    await expect.element(screen.getByRole('button', { name: 'Gemini North' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('should open the next visit where the reader works when a site was chosen', async () => {
    const first = await renderNavbar('/night');
    await expect.element(first.getByRole('button', { name: 'Gemini North' })).toHaveAttribute('aria-pressed', 'true');

    await chooseSite(first, 'GS');
    await expect.poll(() => first.router.location.search).toContain('site=GS');
    await first.unmount();

    const second = await renderNavbar('/night');

    await expect.element(second.getByRole('button', { name: 'Gemini South' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('should write the site it resolved into the URL, so Back and a copied link both carry it, when the URL names none', async () => {
    const screen = await renderNavbar('/night');

    await expect.poll(() => screen.router.location.search).toBe('?site=GN');
    expect(screen.router.navigationType).toBe('REPLACE');

    await chooseSite(screen, 'GS');
    await expect.poll(() => screen.router.location.search).toBe('?site=GS');

    await screen.router.navigate(-1);
    await expect.poll(() => screen.router.location.search).toBe('?site=GN');
    await expect.element(screen.getByRole('button', { name: 'Gemini North' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('should correct the site, rather than rendering one and saying another, when the URL names one it cannot mean', async () => {
    const screen = await renderNavbar('/night?site=gs');

    await expect.poll(() => screen.router.location.search).toBe('?site=GN');
    await expect.element(screen.getByRole('button', { name: 'Gemini North' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('should follow the URL over the remembered site when a shared link names one', async () => {
    setLastSite('GS');
    const screen = await renderNavbar('/night?site=GN');

    await expect.element(screen.getByRole('button', { name: 'Gemini North' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('should offer no semester control when it mounts, since the semester belongs to its own page', async () => {
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

  it('should keep one interactive element per clock row when the menu opens, so the row is the whole control', async () => {
    const screen = await renderNavbar();

    await openAppMenu(screen);

    const radio = clockChoice('UTC').element();
    expect(radio.querySelectorAll('a[href], button, input, [tabindex]:not([tabindex="-1"])')).toHaveLength(0);
  });

  it('takes Enter on the site control, the way every button does', async () => {
    const screen = await renderNavbar('/night?site=GS');

    screen.getByRole('button', { name: 'Gemini North' }).element().focus();
    await userEvent.keyboard('{Enter}');

    await expect.poll(() => screen.router.location.search).toContain('site=GN');
  });

  it('should offer no way to choose a backend when the menu opens, since there is one and it is not a setting', async () => {
    const screen = await renderNavbar();

    await expect.element(screen.getByLabelText('Site', { exact: true })).toBeInTheDocument();
    await expect.element(screen.getByLabelText('Data', { exact: true })).not.toBeInTheDocument();
  });

  it('offers the clock in the menu, defaulting to the site clock', async () => {
    const screen = await renderNavbar();
    await openAppMenu(screen);
    await expect.element(clockChoice('Site time')).toHaveAttribute('aria-checked', 'true');
    await expect.element(clockChoice('UTC')).toHaveAttribute('aria-checked', 'false');
  });

  it('should keep the clock out of the bar when it mounts, since it is a habit, not a selection', async () => {
    const screen = await renderNavbar();

    await expect.element(screen.getByRole('group', { name: 'Clock' })).not.toBeInTheDocument();
  });

  it('should switch every clock in the app to UT when UTC is chosen', async () => {
    const screen = await openNightInShell();
    await expect.poll(() => nightAxisLabels()[0]).toBe('14:00');

    await chooseClock(screen, 'UTC');
    await expect.poll(() => nightAxisLabels()[0]).toBe('18:00');
  });

  it('should switch the clock when its row is chosen from the keyboard', async () => {
    const screen = await openNightInShell();
    await expect.poll(() => nightAxisLabels()[0]).toBe('14:00');

    await openAppMenu(screen);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    await expect.poll(() => nightAxisLabels()[0]).toBe('18:00');
  });

  it('should operate the clock with menu-native keys when the menu is driven from the keyboard', async () => {
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

  it('should keep the clock chosen when the masthead mounts again', async () => {
    const first = await renderNavbar();
    await chooseClock(first, 'UTC');
    await first.unmount();

    const second = await renderNavbar();
    await openAppMenu(second);

    await expect.element(clockChoice('UTC')).toHaveAttribute('aria-checked', 'true');
  });

  it('should carry no environment badge when it mounts, since the banner above the shell says it', async () => {
    const screen = await renderNavbar();

    await expect.element(screen.getByTestId('env-marker')).not.toBeInTheDocument();
  });

  it('should open About Resource, naming the running build, when it is chosen from the menu', async () => {
    const screen = await renderNavbar('/night?site=GS');

    await screen.getByRole('button', { name: 'Menu' }).click();
    const about = page.getByText('About Resource');
    await expect.element(about).toBeVisible();
    await about.click();

    const dialog = page.getByTestId('about-resource');
    await expect.element(dialog).toBeVisible();
    await expect.element(dialog.getByText(new RegExp(`.+-${VERSION_SUFFIX[CURRENT_ENV.name]}$`, 'u'))).toBeVisible();
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

  it('offers the ORCID login as a link the browser follows', async () => {
    const screen = await renderNavbar();

    await openAppMenu(screen);

    await expect.element(page.getByRole('link', { name: 'Login with ORCID' })).toHaveAttribute('href', signInUrl());
    const logo = page.getByRole('menuitem', { name: 'Login with ORCID' }).element().querySelector('img');
    expect(logo).not.toBeNull();
    expect(logo!.getAttribute('src')).toBe(orcidLogo);
    expect(logo!.getAttribute('alt')).toBe('');
    expect(logo!.getAttribute('aria-hidden')).toBe('true');
    await expect.element(page.getByRole('menuitem', { name: 'Login with ORCID' })).not.toHaveAttribute('aria-disabled');
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
    'should close the menu and hand focus back to the button when %s is pressed, so the tab sequence continues from it',
    async (keys) => {
      const screen = await renderWithRoute(<Layout />, { route: '/night?site=GS' });
      const menuButton = screen.getByRole('button', { name: 'Menu' }).element();

      await openAppMenu(screen);
      await expect.poll(() => document.activeElement?.getAttribute('role')).toBe('menu');
      await userEvent.keyboard(keys);

      await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
      await expect.poll(() => document.activeElement).toBe(menuButton);
    },
  );

  it.each(MENU_CLOSERS)(
    'should tell assistive technology the menu is open and which list the button controls until %s closes it',
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
    ['signed out', session(), 'Not signed in', null, 'Login with ORCID'],
    ['the token has expired', session(fakeJwt(standardUser('staff'), -60)), 'Not signed in', null, 'Login with ORCID'],
    ['signed in', session(staffToken()), 'Ada Lovelace', 'Ada Lovelace', 'Logout'],
    ['checking', session(null, false), 'Checking sign-in', null, null],
  ])(
    'should name the account and offer only the auth item that applies when %s',
    async (_state, initialValues, label, title, item) => {
      const screen = await renderWithRoute(<Navbar />, { route: '/', initialValues });

      const account = screen.getByTestId('account-control');
      await expect.element(account).toHaveTextContent(label);
      await expect.poll(() => account.element().getAttribute('title')).toBe(title);

      await openAppMenu(screen);

      await expect.element(page.getByRole('menu').getByText(label, { exact: true })).toBeVisible();
      const offered = ['Login with ORCID', 'Logout'].filter(
        (name) => page.getByRole('menuitem', { name }).elements().length > 0,
      );
      expect(offered).toEqual(item === null ? [] : [item]);
    },
  );

  it('should keep every row of the menu to what `role="menu"` may own, at every depth, when the menu opens', async () => {
    const screen = await renderNavbar();

    await openAppMenu(screen);
    const menu = page.getByRole('menu').element();

    const rows = [...menu.children];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(MENU_OWNABLE).toContain(row.getAttribute('role'));
    }
    expect([...menu.querySelectorAll(MENU_FORBIDDEN.join(', '))]).toHaveLength(0);
  });

  it('should sign out before SSO answers and hand focus back to the menu button when Logout is chosen', async () => {
    stubSso();
    const screen = await renderSignedIn();
    await openAppMenu(screen);
    await page.getByRole('menuitem', { name: 'Logout' }).click();

    await expect.element(screen.getByTestId('account-control')).toHaveTextContent('Not signed in');
    const menuButton = screen.getByRole('button', { name: 'Menu' }).element();
    await expect.poll(() => document.activeElement).toBe(menuButton);

    setToken(screen.store, staffToken());

    await expect.element(screen.getByTestId('account-control')).toHaveTextContent('Ada Lovelace');
    await openAppMenu(screen);
    await expect.element(page.getByRole('menuitem', { name: 'Logout' })).toBeVisible();
  });

  it('should send the login return address to the page actually open, not a fixed default, when the reader is signed out', async () => {
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
