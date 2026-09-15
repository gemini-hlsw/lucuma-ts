import { describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import NightPage from '@/app/pages/NightPage';
import { setLastSite } from '@/app/useLastSite';
import { chooseClock, chooseSite, openAppMenu } from '@/test/helpers';
import { renderApp } from '@/test/renderApp';

import Layout from './Layout';
import Navbar from './Navbar';

// The navbar carries the global selection, so it reads the mock API through renderApp.
const renderNavbar = async (route = '/') => renderApp({ element: <Navbar />, route });

describe(Navbar, () => {
  it('renders the Resource wordmark', async () => {
    const screen = await renderNavbar();

    await expect.element(screen.getByText('Resource')).toBeVisible();
  });

  it('links the wordmark to tonight, dropping the deep-linked night', async () => {
    // The brand goes home: /night with no night parameter. The site survives; page state does not.
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

    // Back returns to the site it left, rather than the memory quietly restoring the new one.
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

    // `role="none"` takes a header's words out of the accessibility tree entirely.
    for (const heading of ['Guest User', 'Clock']) {
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

  it('heads the menu with the account at every width, where sign-out will land', async () => {
    const screen = await renderNavbar();

    await openAppMenu(screen);

    await expect.element(page.getByRole('menu').getByText('Guest User', { exact: true })).toBeVisible();
  });

  it('offers no way to choose a backend - there is one, and it is not a setting', async () => {
    // One backend, so a Demo | Live control would be chrome pretending to be a choice.
    const screen = await renderNavbar();

    await expect.element(screen.getByLabelText('Site', { exact: true })).toBeInTheDocument();
    await expect.element(screen.getByLabelText('Data', { exact: true })).not.toBeInTheDocument();
  });

  it('offers the clock in the menu, defaulting to the site clock', async () => {
    const screen = await renderNavbar();
    await openAppMenu(screen);

    // A radio group, not two commands: the pair is one choice, and says which half holds.
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

    // Chile runs UTC-3 in November: the same boundary, named as UTC so nobody mistakes it.
    await expect.element(screen.getByText('17:00 to 17:00 UTC', { exact: false })).toBeVisible();
  });

  it('switches the clock from the keyboard, the row being the whole control', async () => {
    // The clock rows carry no anchor of their own, so activation has to reach the row itself.
    const screen = await renderApp({
      element: <Layout />,
      route: '/night?site=GS&night=2026-11-14',
      path: '/',
      childRoutes: [{ path: 'night', element: <NightPage /> }],
    });
    await expect.element(screen.getByText('14:00 to 14:00 site time', { exact: false })).toBeVisible();

    await openAppMenu(screen);
    // Opening focuses the first row and the headers are skipped, so one step down reaches UTC.
    await userEvent.keyboard('{ArrowDown}{Enter}');

    await expect.element(screen.getByText('17:00 to 17:00 UTC', { exact: false })).toBeVisible();
  });

  it('operates the clock from the keyboard - the spike kept menu-native navigation for exactly this', async () => {
    // PrimeReact's Menu tracks focus as an active-descendant on the list, not real DOM focus per item -
    // the fact the spike's rejected SegmentedControl-in-a-menuitem could not do at all.
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

    // Opening the menu already focuses "Site time", the first choice; one step reaches "UTC".
    await userEvent.keyboard('{ArrowDown}');
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
    // The popup renders into document.body; wait for it so the click never races the mount.
    const about = page.getByText('About Resource');
    await expect.element(about).toBeVisible();
    await about.click();

    const dialog = page.getByTestId('about-resource');
    await expect.element(dialog).toBeVisible();
    // Explore's VERSION+DATE.COMMIT-ENV form, and the endpoint this serving actually reads.
    await expect.element(dialog.getByText(/Version: .+-DEV/)).toBeVisible();
    await expect.element(dialog.getByText('/resource/graphql', { exact: false })).toBeVisible();
  });

  it('keeps the login in the menu, disabled until SSO arrives', async () => {
    const screen = await renderNavbar('/night?site=GS');

    await screen.getByRole('button', { name: 'Menu' }).click();

    const login = page.getByRole('menuitem', { name: 'Login with ORCID' });
    await expect.element(login).toBeVisible();
    await expect.element(login).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows the account control as the placeholder it is until SSO lands', async () => {
    const screen = await renderNavbar();

    const account = screen.getByTestId('account-control');
    await expect.element(account).toHaveTextContent('Guest User');
    await expect
      .element(account)
      .toHaveAttribute('title', 'Authentication is not implemented yet - the mock allows everything.');
  });
});
