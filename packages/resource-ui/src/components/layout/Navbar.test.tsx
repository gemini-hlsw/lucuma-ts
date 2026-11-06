import { toastAtom, VERSION_SUFFIX } from '@gemini-hlsw/lucuma-common-ui';
import { fakeJwt, standardUser } from '@gemini-hlsw/lucuma-common-ui/testing';
import type { ToastMessage } from 'primereact/toast';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type LocatorSelectors, page, userEvent } from 'vitest/browser';

import { CURRENT_ENV } from '@/app/environment';
import NightPage from '@/app/pages/NightPage';
import { setLastSite } from '@/app/useLastSite';
import orcidLogo from '@/assets/orcid-logo.svg';
import { AuthSession } from '@/auth/AuthSession';
import {
  SESSION_CHANNEL,
  SESSION_TIMINGS,
  type SessionTimings,
  SIGNED_OUT_MESSAGE,
  startSession,
} from '@/auth/session';
import { signInUrl } from '@/auth/ssoClient';
import { odbTokenAtom, sessionCheckedAtom, setToken } from '@/components/atoms/auth';
import { ToastOutlet } from '@/components/ui/ToastOutlet';
import { nightAxisLabels } from '@/test/chartProbe';
import { nightSchedule } from '@/test/fixtures/night';
import { chooseClock, chooseSite, clockChoice, fakeTimeouts, openAppMenu } from '@/test/helpers';
import { renderInShell, type RenderResultWithRoute, renderWithRoute } from '@/test/render';
import { ssoCall, ssoRefreshes, stubSso } from '@/test/sso';

import { Layout } from './Layout';
import { Navbar } from './Navbar';

const NAVBAR_WITH_TOASTS = (
  <>
    <Navbar />
    <ToastOutlet />
  </>
);

type Session = [[typeof odbTokenAtom, string | null], [typeof sessionCheckedAtom, boolean]];
const session = (token: string | null = null, checked = true): Session => [
  [odbTokenAtom, token],
  [sessionCheckedAtom, checked],
];

/** A function, so each token's `exp` counts from the moment the test asks for it. */
const staffToken = () => fakeJwt(standardUser('staff'));

const renderNavbar = async (route = '/') => renderWithRoute(NAVBAR_WITH_TOASTS, { route, initialValues: session() });

const renderSignedIn = async () =>
  renderWithRoute(NAVBAR_WITH_TOASTS, { route: '/', initialValues: session(staffToken()) });

/** The bar under the real session keeper, so SSO's answers and other tabs' messages reach it. */
const renderInSession = async (token = staffToken(), timings?: SessionTimings) =>
  renderWithRoute(<AuthSession {...(timings ? { timings } : {})}>{NAVBAR_WITH_TOASTS}</AuthSession>, {
    route: '/',
    initialValues: session(token),
  });

const NIGHT = '2026-11-14';

/** The night page inside the real shell: the subject is the clock its chart axis prints. */
const NIGHT_SCHEDULE = nightSchedule({ site: 'GS', night: NIGHT });

const openNightInShell = async () =>
  renderInShell(<NightPage />, { route: `/night?site=GS&night=${NIGHT}`, mocks: [NIGHT_SCHEDULE] });

const SESSION_ENDED = 'Your session ended';
const LOGOUT_UNREACHABLE = 'Logout did not reach SSO';
const SIGNED_OUT_ELSEWHERE = 'You signed out in another tab';
const TEN_MINUTES = 10 * 60 * 1000;
/** Renews a sixty-second token at once, so the refusal and not the token's own expiry ends the session. */
const RENEW_AT_ONCE = { ...SESSION_TIMINGS, refreshAheadMs: 60_000 };
const FLUSH = { severity: 'info', summary: 'Flushed' } satisfies ToastMessage;
const MENU_OWNABLE = ['menuitem', 'menuitemradio', 'menuitemcheckbox', 'group', 'separator'];
const MENU_FORBIDDEN = ['[role="status"]', '[role="alert"]', '[role="log"]', '[role="none"]', '[aria-live]'];

const logOutFromMenu = async () => {
  stubSso();
  const screen = await renderSignedIn();
  await openAppMenu(screen);
  await page.getByRole('menuitem', { name: 'Logout' }).click();
  return screen;
};

const toastNamed = (summary: string) => page.getByRole('alert').filter({ hasText: summary });

/** A closing toast stays in the DOM through PrimeReact's exit transition, marked by this class. */
async function expectShowing(summary: string): Promise<void> {
  await expect.element(toastNamed(summary)).toBeVisible();
  await expect.element(toastNamed(summary)).not.toHaveClass('p-toast-message-exit');
}

/** Toasts still on screen, leaving out those closing and the one `afterPendingWork` flushes with. */
const noticesShowing = (): string[] =>
  page
    .getByRole('alert')
    .elements()
    .filter((toast) => !toast.classList.contains('p-toast-message-exit'))
    .map((toast) => toast.textContent)
    .filter((text) => text !== FLUSH.summary);

/** Once this toast renders, so has every update queued before it, including a show from a promise already settled, whose callbacks run before React renders. */
async function afterPendingWork(screen: RenderResultWithRoute): Promise<void> {
  const toast = screen.store.get(toastAtom)!;
  toast.show(FLUSH);
  await expect.element(toastNamed(FLUSH.summary)).toBeInTheDocument();
  toast.remove(FLUSH);
}

/** Logs out without polling for the menu, so it does not mix polling with fake timers. */
const logOutAtOnce = async (screen: RenderResultWithRoute): Promise<void> => {
  await screen.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Logout' }).click();
};

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

afterEach(() => {
  vi.useRealTimers();
});

describe(Navbar, () => {
  it('should render the Resource wordmark when mounted', async () => {
    const screen = await renderNavbar();

    await expect.element(screen.getByText('Resource')).toBeVisible();
  });

  it('should link the wordmark to tonight, dropping the night, page state and clock, when the reader is deep-linked', async () => {
    const screen = await renderNavbar('/semester?site=GS&night=2026-11-14&q=GPI');
    await chooseClock(screen, 'UTC');

    const brand = screen.getByRole('link', { name: 'Resource', exact: false });
    await expect.element(brand).toHaveAttribute('href', '/night?site=GS');
  });

  it('should carry the site beside the wordmark, announcing the telescope behind the code, when given a site', async () => {
    const screen = await renderNavbar('/night?site=GS');

    await expect.element(screen.getByRole('group', { name: 'Site' })).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Gemini South' })).toHaveAttribute('aria-pressed', 'true');
    await expect.element(screen.getByRole('button', { name: 'Gemini North' })).toHaveAttribute('aria-pressed', 'false');
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

  it('should offer no semester control, since the semester belongs to its own page, when rendered', async () => {
    const screen = await renderNavbar('/night?site=GS&semester=2026B');

    await expect.element(screen.getByLabelText('Semester', { exact: true })).not.toBeInTheDocument();
  });

  it('should expose both menu headers as named groups, not as stripped presentation rows, when the menu opens', async () => {
    const screen = await renderNavbar();

    await openAppMenu(screen);
    for (const heading of ['Not signed in', 'Clock']) {
      await expect.element(page.getByRole('group').getByText(heading, { exact: true })).toBeVisible();
    }
  });

  it('should keep one interactive element per clock row, so the row is the whole control, when the menu opens', async () => {
    const screen = await renderNavbar();

    await openAppMenu(screen);

    const radio = clockChoice('UTC').element();
    expect(radio.querySelectorAll('a[href], button, input, [tabindex]:not([tabindex="-1"])')).toHaveLength(0);
  });

  it('should change the site, the way every button does, when Enter is pressed on the site control', async () => {
    const screen = await renderNavbar('/night?site=GS');

    screen.getByRole('button', { name: 'Gemini North' }).element().focus();
    await userEvent.keyboard('{Enter}');

    await expect.poll(() => screen.router.location.search).toContain('site=GN');
  });

  it('should offer no way to choose a backend, since there is one and it is not a setting, when rendered', async () => {
    const screen = await renderNavbar();

    await expect.element(screen.getByLabelText('Site', { exact: true })).toBeInTheDocument();
    await expect.element(screen.getByLabelText('Data', { exact: true })).not.toBeInTheDocument();
  });

  it('should offer the clock in the menu, defaulting to the site clock, when the menu opens', async () => {
    const screen = await renderNavbar();
    await openAppMenu(screen);
    await expect.element(clockChoice('Site time')).toHaveAttribute('aria-checked', 'true');
    await expect.element(clockChoice('UTC')).toHaveAttribute('aria-checked', 'false');
  });

  it('should keep the clock out of the bar, since it is a habit and not a selection, when rendered', async () => {
    const screen = await renderNavbar();

    await expect.element(screen.getByRole('group', { name: 'Clock' })).not.toBeInTheDocument();
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

  it('should carry no environment badge, since the banner above the shell says it instead, when rendered', async () => {
    const screen = await renderNavbar();

    await expect.element(screen.getByTestId('env-marker')).not.toBeInTheDocument();
  });

  it('should open About Resource, naming the running build, when it is chosen from the hamburger menu', async () => {
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

  it('should hand focus back to the menu button when About is dismissed from the keyboard', async () => {
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

  it('should hand focus back to the menu button when About is closed by its own button', async () => {
    const screen = await renderNavbar('/night?site=GS');
    const menuButton = screen.getByRole('button', { name: 'Menu' }).element() as HTMLElement;

    await openAppMenu(screen);
    await page.getByRole('menuitem', { name: 'About Resource' }).click();
    await expect.element(page.getByTestId('about-resource')).toBeVisible();

    await page.getByRole('button', { name: 'Close' }).click();

    await expect.element(page.getByTestId('about-resource')).not.toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(menuButton);
  });

  it('should offer the ORCID login as a link the browser follows when the reader is signed out', async () => {
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

  it('should close the menu, and let the click take focus with it, when the reader clicks outside it', async () => {
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
    'should close the menu and hand focus back to the button, so the tab sequence continues from it, when %s is pressed',
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
    'should tell assistive technology the menu is open and which list the button controls when the menu opens, until %s closes it',
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

  it('should name the list that carries the menu role, not the wrapper around it, when the menu opens', async () => {
    const screen = await renderNavbar();

    await openAppMenu(screen);

    await expect.element(page.getByRole('menu', { name: 'Application menu' })).toBeVisible();
  });

  it('should read About first and the account block last, the order Explore uses, when the menu opens', async () => {
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
    'names the account and offers only the auth item that applies when %s',
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

  it('should warn in a toast until the next sign-in when the logout never reached SSO', async () => {
    const screen = await logOutFromMenu();
    await expect.element(screen.getByRole('status')).toHaveTextContent('Logged out');

    ssoCall(0).fail();

    await expectShowing(LOGOUT_UNREACHABLE);
    await expect
      .element(toastNamed(LOGOUT_UNREACHABLE).getByText('Close the browser to end the session.'))
      .toBeVisible();
    expect(screen.getByRole('status').element().textContent).toBe('Logged out');

    setToken(screen.store, staffToken());

    await expect.element(toastNamed(LOGOUT_UNREACHABLE)).not.toBeInTheDocument();
  });

  it('should keep every row of the menu, at every depth, to what `role="menu"` may own when the menu opens', async () => {
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

  it('should sign out before SSO answers, hand focus back to the menu button, and announce again after a fresh sign-in, when the reader logs out from the menu', async () => {
    const screen = await logOutFromMenu();
    await expect.element(screen.getByTestId('account-control')).toHaveTextContent('Not signed in');
    await expect.element(screen.getByRole('status')).toHaveTextContent('Logged out');
    const menuButton = screen.getByRole('button', { name: 'Menu' }).element();
    await expect.poll(() => document.activeElement).toBe(menuButton);

    setToken(screen.store, staffToken());
    await expect.element(screen.getByTestId('account-control')).toHaveTextContent('Ada Lovelace');
    await expect.element(screen.getByRole('status')).toHaveTextContent('');

    await openAppMenu(screen);
    await expect.element(page.getByRole('menuitem', { name: 'Logout' })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Logout' }).click();

    await expect.element(screen.getByTestId('account-control')).toHaveTextContent('Not signed in');
    await expect.element(screen.getByRole('status')).toHaveTextContent('Logged out');
  });

  it('should send the login return address to the page actually open, not a fixed default, when ORCID login is offered', async () => {
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

  it('should show a notice when SSO refuses to renew the session', async () => {
    stubSso();
    await renderInSession(fakeJwt(standardUser('staff'), 60), RENEW_AT_ONCE);

    await expect.poll(() => ssoRefreshes()).toHaveLength(1);
    ssoRefreshes()[0]?.answer({ status: 403 });

    await expectShowing(SESSION_ENDED);
    await expect
      .element(
        toastNamed(SESSION_ENDED).getByText('Choose "Login with ORCID" from the menu to sign in again.', {
          exact: true,
        }),
      )
      .toBeVisible();
  });

  it('should say the reader signed out in another tab, and after a fresh sign-in that the session ended, when each ends the session in turn', async () => {
    stubSso();
    const screen = await renderInSession();
    const otherTab = new BroadcastChannel(SESSION_CHANNEL);

    try {
      otherTab.postMessage(SIGNED_OUT_MESSAGE);
      await expectShowing(SIGNED_OUT_ELSEWHERE);
    } finally {
      otherTab.close();
    }

    expect(noticesShowing()).toEqual([expect.stringContaining(SIGNED_OUT_ELSEWHERE)]);

    setToken(screen.store, fakeJwt(standardUser('staff'), 60));
    await expect.element(toastNamed(SIGNED_OUT_ELSEWHERE)).not.toBeInTheDocument();

    const stop = startSession(screen.store, RENEW_AT_ONCE);
    try {
      await expect.poll(() => ssoRefreshes()).toHaveLength(1);
      ssoRefreshes()[0]?.answer({ status: 403 });
      await expectShowing(SESSION_ENDED);
    } finally {
      stop();
    }
    expect(noticesShowing()).toEqual([expect.stringContaining(SESSION_ENDED)]);
  });

  it.each([
    ['from the first render', session(null, true)],
    ['once the first check settles', session(null, false)],
  ])('should show no session-ended notice when a visitor is signed out %s', async (_when, initialValues) => {
    const screen = await renderWithRoute(NAVBAR_WITH_TOASTS, { route: '/', initialValues });

    screen.store.set(sessionCheckedAtom, true);

    await expect.element(screen.getByTestId('account-control')).toHaveTextContent('Not signed in');
    expect(noticesShowing()).toEqual([]);
  });

  it.each([
    [SESSION_ENDED, (screen: RenderResultWithRoute) => setToken(screen.store, null)],
    [
      LOGOUT_UNREACHABLE,
      async (screen: RenderResultWithRoute) => {
        await logOutAtOnce(screen);
        ssoCall(0).fail();
        await vi.advanceTimersByTimeAsync(0);
      },
    ],
  ])('should keep "%s" on screen when ten minutes pass', async (summary, end) => {
    fakeTimeouts();
    stubSso();
    const screen = await renderSignedIn();

    end(screen);
    await expect.poll(noticesShowing).toContainEqual(expect.stringContaining(summary));
    await vi.advanceTimersByTimeAsync(TEN_MINUTES);

    await expect.poll(noticesShowing).toContainEqual(expect.stringContaining(summary));
  });

  it(`should keep "${SIGNED_OUT_ELSEWHERE}" on screen when ten minutes pass`, async () => {
    fakeTimeouts();
    stubSso();
    await renderInSession();
    const otherTab = new BroadcastChannel(SESSION_CHANNEL);
    // A channel delivers to its listeners in the order they opened, so this one hears the message after the session keeper has.
    const listener = new BroadcastChannel(SESSION_CHANNEL);
    const delivered = new Promise((resolve) => {
      listener.addEventListener('message', resolve, { once: true });
    });

    try {
      otherTab.postMessage(SIGNED_OUT_MESSAGE);
      await delivered;
      await expect.poll(noticesShowing).toContainEqual(expect.stringContaining(SIGNED_OUT_ELSEWHERE));
      await vi.advanceTimersByTimeAsync(TEN_MINUTES);

      expect(noticesShowing()).toContainEqual(expect.stringContaining(SIGNED_OUT_ELSEWHERE));
    } finally {
      otherTab.close();
      listener.close();
    }
  });

  it.each([
    ['after the reader logs out', 'Logged out', () => ssoCall(0).answer({ status: 200 })],
    [
      'SSO fails only after the reader signed in again',
      '',
      (screen: RenderResultWithRoute) => {
        setToken(screen.store, staffToken());
        ssoCall(0).fail();
      },
    ],
  ])('should show no notice when the reader logs out and %s', async (_when, announcement, settle) => {
    fakeTimeouts();
    stubSso();
    const screen = await renderSignedIn();

    await logOutAtOnce(screen);
    settle(screen);
    await vi.advanceTimersByTimeAsync(0);

    await expect.element(screen.getByRole('status')).toHaveTextContent(announcement);
    expect(noticesShowing()).toEqual([]);
  });

  it('should remove the session-ended notice once the reader signs in, and show one when the next session ends', async () => {
    const screen = await renderSignedIn();
    setToken(screen.store, null);
    await expectShowing(SESSION_ENDED);

    setToken(screen.store, staffToken());
    await expect.element(toastNamed(SESSION_ENDED)).not.toBeInTheDocument();

    setToken(screen.store, null);
    await expectShowing(SESSION_ENDED);
    await afterPendingWork(screen);

    expect(noticesShowing().filter((text) => text.startsWith(SESSION_ENDED))).toHaveLength(1);
  });

  it('should warn when the session ends on its own after an earlier logout and a fresh sign-in', async () => {
    const screen = await logOutFromMenu();
    ssoCall(0).answer({ status: 200 });
    setToken(screen.store, staffToken());
    await expect.element(screen.getByTestId('account-control')).toHaveTextContent('Ada Lovelace');

    setToken(screen.store, null);

    await expectShowing(SESSION_ENDED);
  });

  it('should show the session-ended notice above the open About dialog, without taking focus from it, when the session ends under it', async () => {
    const screen = await renderSignedIn();
    await openAppMenu(screen);
    await page.getByRole('menuitem', { name: 'About Resource' }).click();
    const dialog = page.getByTestId('about-resource');
    await expect.element(dialog).toBeVisible();
    const copy = dialog.getByRole('button', { name: 'Copy version' }).element() as HTMLElement;
    copy.focus();

    setToken(screen.store, null);
    await expectShowing(SESSION_ENDED);

    expect(document.activeElement).toBe(copy);
    await toastNamed(SESSION_ENDED).getByRole('button', { name: 'Close' }).click();
    await expect.element(toastNamed(SESSION_ENDED)).not.toBeInTheDocument();
    await expect.element(dialog).toBeVisible();
  });
});
