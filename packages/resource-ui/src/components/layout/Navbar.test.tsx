import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';

import NightPage from '@/app/pages/NightPage';
import { selectDropdownOption } from '@/test/helpers';
import { renderApp } from '@/test/renderApp';

import Layout from './Layout';
import Navbar from './Navbar';

// The navbar carries the global selection, so it reads the mock API (the
// published semesters) - renderApp provides the Apollo client and the router.
const renderNavbar = async (route = '/') => renderApp({ element: <Navbar />, route });

describe(Navbar.name, () => {
  it('renders the Resource wordmark', async () => {
    const screen = await renderNavbar();

    await expect.element(screen.getByText('Resource')).toBeVisible();
  });

  it('links the wordmark to tonight, dropping the deep-linked night', async () => {
    // From a deep link into a specific night, the brand goes home: /night with
    // no night parameter means the night in progress. The site survives;
    // page state does not.
    const screen = await renderNavbar('/semester?site=GS&night=2026-11-14&view=grid');

    const brand = screen.getByRole('link', { name: 'Resource', exact: false });
    await expect.element(brand).toHaveAttribute('href', '/night?site=GS');
  });

  it('carries the site and semester selection', async () => {
    const screen = await renderNavbar('/night?site=GS&semester=2026B');

    // Exact, or the clock toggle's "Site local time" segment also matches.
    await expect.element(screen.getByLabelText('Site', { exact: true })).toBeInTheDocument();
    await expect.element(screen.getByLabelText('Semester', { exact: true })).toBeInTheDocument();
  });

  it('shows the semester holding the night when the URL names none', async () => {
    const screen = await renderNavbar('/night?site=GS&night=2025-11-14');

    const wrapper = screen.getByLabelText('Semester', { exact: true }).element().closest('.p-dropdown');
    expect(wrapper?.querySelector('.p-dropdown-label')?.textContent).toBe('2025B');
  });

  it('never blanks on a stale semester name - it resolves to the night instead', async () => {
    // A link minted before the data moved on (a removed demo, another site's
    // semester) must still land somewhere real.
    const screen = await renderNavbar('/night?site=GS&semester=2099B&night=2025-11-14');

    const wrapper = screen.getByLabelText('Semester', { exact: true }).element().closest('.p-dropdown');
    expect(wrapper?.querySelector('.p-dropdown-label')?.textContent).toBe('2025B');
  });

  it('shows the nearest semester when the night is beyond every one - Tonight past the edge', async () => {
    // What Tonight does once the workbook's data ends: the night walks past
    // 2026A at GS, and the control keeps offering the closest real semester
    // rather than going blank over a night with no data.
    const screen = await renderNavbar('/night?site=GS&night=2030-01-01');

    const wrapper = screen.getByLabelText('Semester', { exact: true }).element().closest('.p-dropdown');
    expect(wrapper?.querySelector('.p-dropdown-label')?.textContent).toBe('2026A');
  });

  it('offers no way to choose a backend - there is one, and it is not a setting', async () => {
    // The masthead carried a Demo | Live control until 2026-08-14. The demo
    // put server-side code in the bundle and went with it; a control over one
    // backend would be chrome pretending to be a choice.
    const screen = await renderNavbar();

    await expect.element(screen.getByLabelText('Site', { exact: true })).toBeInTheDocument();
    await expect.element(screen.getByLabelText('Data', { exact: true })).not.toBeInTheDocument();
  });

  it('moves the night into a chosen semester the current night is outside', async () => {
    // The semester control must mean "take me to that semester" on the night
    // view, never a silent no-op: choosing 2025A from a 2026B night lands on
    // 2025A's first night.
    const screen = await renderApp({
      element: <Layout />,
      route: '/night?site=GS&night=2026-11-14',
      path: '/',
      childRoutes: [{ path: 'night', element: <NightPage /> }],
    });
    await expect.element(screen.getByText('Night of 2026-11-14')).toBeVisible();

    await selectDropdownOption(screen, 'Semester', '2025A');

    await expect.element(screen.getByText('Night of 2025-02-02')).toBeVisible();
  });

  it('offers the clock choice, defaulting to the site clock', async () => {
    const screen = await renderNavbar();

    const toggle = screen.getByRole('group', { name: 'Clock' });
    await expect.element(toggle).toBeVisible();
    await expect
      .element(screen.getByRole('button', { name: 'Site local time' }))
      .toHaveAttribute('aria-pressed', 'true');
  });

  it('switches every clock in the app to UT', async () => {
    const screen = await renderApp({
      element: <Layout />,
      route: '/night?site=GS&night=2026-11-14',
      path: '/',
      childRoutes: [{ path: 'night', element: <NightPage /> }],
    });
    await expect.element(screen.getByText('14:00 to 14:00 site time', { exact: false })).toBeVisible();

    await screen.getByRole('button', { name: 'Coordinated Universal Time' }).click();

    // Chile runs UTC-3 in November: the same night boundary, read off the
    // other clock - and named as UTC, so nobody mistakes which one they see.
    await expect.element(screen.getByText('17:00 to 17:00 UTC', { exact: false })).toBeVisible();
  });

  it('keeps the clock choice on the way home, like the site', async () => {
    // The clock is chrome, not page state, so the brand link carries it the
    // way it carries the site - a reader who chose UT stays in UT.
    const screen = await renderNavbar('/semester?site=GS&night=2026-11-14&clock=utc');

    const brand = screen.getByRole('link', { name: 'Resource', exact: false });
    await expect.element(brand).toHaveAttribute('href', '/night?site=GS&clock=utc');
  });

  it('wears the environment badge, so nobody mistakes this for production', async () => {
    const screen = await renderNavbar();

    await expect.element(screen.getByTestId('env-marker')).toHaveTextContent('Development');
  });

  it('opens About Resource from the hamburger menu, naming the running build', async () => {
    const screen = await renderNavbar('/night?site=GS');

    await screen.getByRole('button', { name: 'Menu' }).click();
    // The popup menu renders into document.body, outside the render container;
    // wait for it before clicking so the click never races the popup mount.
    const about = page.getByText('About Resource');
    await expect.element(about).toBeVisible();
    await about.click();

    const dialog = page.getByTestId('about-resource');
    await expect.element(dialog).toBeVisible();
    // The build version in Explore's DATE-COMMIT-ENV form, and the endpoint
    // this running Resource is actually reading.
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
    await expect.element(account).toHaveTextContent('Guest');
    await expect
      .element(account)
      .toHaveAttribute('title', 'Authentication is not implemented yet - the mock allows everything.');
  });
});
