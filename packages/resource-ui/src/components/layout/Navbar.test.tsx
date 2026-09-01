import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';

import NightPage from '@/app/pages/NightPage';
import { selectDropdownOption } from '@/test/helpers';
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
    // A link minted before the data moved on must still land somewhere real.
    const screen = await renderNavbar('/night?site=GS&semester=2099B&night=2025-11-14');

    const wrapper = screen.getByLabelText('Semester', { exact: true }).element().closest('.p-dropdown');
    expect(wrapper?.querySelector('.p-dropdown-label')?.textContent).toBe('2025B');
  });

  it('shows the nearest semester when the night is beyond every one - Tonight past the edge', async () => {
    // Past the workbook's edge the control keeps offering the closest real semester.
    const screen = await renderNavbar('/night?site=GS&night=2030-01-01');

    const wrapper = screen.getByLabelText('Semester', { exact: true }).element().closest('.p-dropdown');
    expect(wrapper?.querySelector('.p-dropdown-label')?.textContent).toBe('2026A');
  });

  it('offers no way to choose a backend - there is one, and it is not a setting', async () => {
    // One backend, so a Demo | Live control would be chrome pretending to be a choice.
    const screen = await renderNavbar();

    await expect.element(screen.getByLabelText('Site', { exact: true })).toBeInTheDocument();
    await expect.element(screen.getByLabelText('Data', { exact: true })).not.toBeInTheDocument();
  });

  it('moves the night into a chosen semester the current night is outside', async () => {
    // The semester control must mean "take me there", never a silent no-op.
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

    // Chile runs UTC-3 in November: the same boundary, named as UTC so nobody mistakes it.
    await expect.element(screen.getByText('17:00 to 17:00 UTC', { exact: false })).toBeVisible();
  });

  it('keeps the clock choice on the way home, like the site', async () => {
    // The clock is chrome, so the brand link carries it the way it carries the site.
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
    await expect.element(account).toHaveTextContent('Guest');
    await expect
      .element(account)
      .toHaveAttribute('title', 'Authentication is not implemented yet - the mock allows everything.');
  });
});
