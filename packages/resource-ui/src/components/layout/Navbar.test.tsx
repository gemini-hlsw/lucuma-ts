import { PrimeReactProvider } from 'primereact/api';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { clockChoice, openAppMenu } from '@/test/helpers';

import { Navbar, type NavbarProps } from './Navbar';

const SIGN_IN_HREF = 'https://sso.example/auth/v1/stage1?state=here';

const PERSON: Pick<NavbarProps, 'accountLabel' | 'isGuest'> = { accountLabel: 'Ada Lovelace', isGuest: false };
const GUEST: Pick<NavbarProps, 'accountLabel' | 'isGuest'> = { accountLabel: 'Guest User', isGuest: true };

const navbarProps = (overrides: Partial<NavbarProps> = {}): NavbarProps => ({
  homeSearch: '?site=GS',
  site: 'GS',
  onSiteChange: vi.fn(),
  timeDisplay: 'site',
  onTimeDisplayChange: vi.fn(),
  ...PERSON,
  signInHref: SIGN_IN_HREF,
  onSignOut: vi.fn(),
  ...overrides,
});

/** The menu's outside click needs PrimeReact's provider and the wordmark is a router `Link`; nothing else is needed. */
const renderNavbar = async (overrides: Partial<NavbarProps> = {}) =>
  render(
    <PrimeReactProvider>
      <MemoryRouter>
        <Navbar {...navbarProps(overrides)} />
      </MemoryRouter>
    </PrimeReactProvider>,
  );

const offeredAuthItems = () =>
  ['Login with ORCID', 'Logout'].filter((name) => page.getByRole('menuitem', { name }).elements().length > 0);

const MENU_OWNABLE = ['menuitem', 'menuitemradio', 'menuitemcheckbox', 'group', 'separator'];
const MENU_FORBIDDEN = ['[role="status"]', '[role="alert"]', '[role="log"]', '[role="none"]', '[aria-live]'];

/** PrimeReact binds its outside-click listener only when the enter transition ends, which this class marks. */
const settleOverlay = async (): Promise<void> => {
  const overlay = () => page.getByRole('menu').element().closest('.p-menu');
  await expect.poll(() => overlay()?.classList.contains('p-connected-overlay-enter-done')).toBe(true);
};

describe(Navbar, () => {
  it('should link the wordmark to tonight with the search when given one', async () => {
    const screen = await renderNavbar({ homeSearch: '?site=GN' });

    const brand = screen.getByRole('link', { name: 'Resource', exact: false });
    await expect.element(brand).toHaveTextContent('Resource');
    await expect.element(brand).toHaveAttribute('href', '/night?site=GN');
  });

  it('should carry the site beside the wordmark, announcing the telescope behind the code, when given a site', async () => {
    const screen = await renderNavbar({ site: 'GS' });

    await expect.element(screen.getByRole('group', { name: 'Site' })).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Gemini South' })).toHaveAttribute('aria-pressed', 'true');
    await expect.element(screen.getByRole('button', { name: 'Gemini North' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('should expose both menu headers as named groups, not as stripped presentation rows, when the menu opens', async () => {
    const screen = await renderNavbar();

    await openAppMenu(screen);
    for (const heading of ['Ada Lovelace', 'Clock']) {
      await expect.element(page.getByRole('group').getByText(heading, { exact: true })).toBeVisible();
    }
  });

  it('should keep one interactive element per clock row, so the row is the whole control, when the menu opens', async () => {
    const screen = await renderNavbar();

    await openAppMenu(screen);

    const radio = clockChoice('UTC').element();
    expect(radio.querySelectorAll('a[href], button, input, [tabindex]:not([tabindex="-1"])')).toHaveLength(0);
  });

  it('should offer no way to choose a backend, since there is one and it is not a setting, when rendered', async () => {
    const screen = await renderNavbar();

    await expect.element(screen.getByLabelText('Site', { exact: true })).toBeInTheDocument();
    await expect.element(screen.getByLabelText('Data', { exact: true })).not.toBeInTheDocument();
  });

  it('should check the clock row when given that clock', async () => {
    const screen = await renderNavbar({ timeDisplay: 'utc' });

    await openAppMenu(screen);

    await expect.element(clockChoice('UTC')).toHaveAttribute('aria-checked', 'true');
    await expect.element(clockChoice('Site time')).toHaveAttribute('aria-checked', 'false');
  });

  it('should report the clock, the row being the whole control, when it is chosen from the keyboard', async () => {
    const onTimeDisplayChange = vi.fn();
    const screen = await renderNavbar({ onTimeDisplayChange });

    await openAppMenu(screen);
    const menuList = () => document.querySelector('ul[role="menu"]');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(menuList()?.getAttribute('aria-activedescendant')).toBe(clockChoice('UTC').element().id);

    await userEvent.keyboard('{Enter}');

    expect(onTimeDisplayChange).toHaveBeenCalledExactlyOnceWith('utc');
  });

  it('should open About Resource and close it on Escape when it is chosen from the hamburger menu', async () => {
    const screen = await renderNavbar();
    await openAppMenu(screen);

    await page.getByRole('menuitem', { name: 'About Resource' }).click();
    await expect.element(page.getByTestId('about-resource')).toBeVisible();
    await userEvent.keyboard('{Escape}');

    await expect.element(page.getByTestId('about-resource')).not.toBeInTheDocument();
  });

  it('should hand focus back to the menu button when About is closed by its own button', async () => {
    const screen = await renderNavbar();
    const menuButton = screen.getByRole('button', { name: 'Menu' }).element() as HTMLElement;

    await openAppMenu(screen);
    await page.getByRole('menuitem', { name: 'About Resource' }).click();
    await expect.element(page.getByTestId('about-resource')).toBeVisible();

    await page.getByRole('button', { name: 'Close' }).click();

    await expect.element(page.getByTestId('about-resource')).not.toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(menuButton);
  });

  it('should offer the ORCID login as a link the browser follows, to the href it is given, when a guest opens the menu', async () => {
    const screen = await renderNavbar(GUEST);

    await openAppMenu(screen);

    await expect.element(page.getByRole('link', { name: 'Login with ORCID' })).toHaveAttribute('href', SIGN_IN_HREF);
    const logo = page.getByRole('menuitem', { name: 'Login with ORCID' }).element().querySelector('img');
    expect(logo).not.toBeNull();
    expect(logo!.getAttribute('alt')).toBe('');
    expect(logo!.getAttribute('aria-hidden')).toBe('true');
    await expect.element(page.getByRole('menuitem', { name: 'Login with ORCID' })).not.toHaveAttribute('aria-disabled');
  });

  it('should report the press once and hand focus back to the menu button when Logout is pressed', async () => {
    const onSignOut = vi.fn();
    const screen = await renderNavbar({ onSignOut });
    const menuButton = screen.getByRole('button', { name: 'Menu' }).element();

    await openAppMenu(screen);
    await page.getByRole('menuitem', { name: 'Logout' }).click();

    expect(onSignOut).toHaveBeenCalledOnce();
    await expect.poll(() => document.activeElement).toBe(menuButton);
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
    'should close the menu and hand focus back to the button, so the tab sequence continues from it, when %s is pressed',
    async (keys) => {
      const screen = await renderNavbar();
      const menuButton = screen.getByRole('button', { name: 'Menu' }).element();

      await openAppMenu(screen);
      await expect.poll(() => document.activeElement?.getAttribute('role')).toBe('menu');
      await userEvent.keyboard(keys);

      await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
      await expect.poll(() => document.activeElement).toBe(menuButton);
    },
  );

  it('should tell assistive technology the menu is open and which list the button controls when the menu opens, until Escape closes it', async () => {
    const screen = await renderNavbar();
    const menuButton = screen.getByRole('button', { name: 'Menu' });

    await expect.element(menuButton).toHaveAttribute('aria-expanded', 'false');
    await expect.element(menuButton).not.toHaveAttribute('aria-controls');

    await openAppMenu(screen);
    await settleOverlay();
    await expect.element(menuButton).toHaveAttribute('aria-expanded', 'true');
    expect(menuButton.element().getAttribute('aria-controls')).toBe(page.getByRole('menu').element().id);

    await userEvent.keyboard('{Escape}');
    await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
    await expect.element(menuButton).toHaveAttribute('aria-expanded', 'false');
    await expect.element(menuButton).not.toHaveAttribute('aria-controls');
  });

  it('names the list that carries the menu role, not the wrapper around it', async () => {
    const screen = await renderNavbar();

    await openAppMenu(screen);

    await expect.element(page.getByRole('menu', { name: 'Application menu' })).toBeVisible();
  });

  it('should read About first and the account block last, the order Explore uses, when the menu opens', async () => {
    const screen = await renderNavbar();

    await openAppMenu(screen);

    const rows = [...page.getByRole('menu').element().children].map((row) => row.textContent?.trim() ?? '');
    expect(rows).toEqual(['About Resource', 'Clock', 'Site time', 'UTC', '', 'Ada Lovelace', 'Logout']);
  });

  it.each([
    ['a guest', GUEST, ['Login with ORCID', 'Logout']],
    ['a person', PERSON, ['Logout']],
  ])(
    'should name the account in the control and offer the auth items that apply, in order, when %s is signed in',
    async (_who, account, items) => {
      const screen = await renderNavbar(account);

      const control = screen.getByTestId('account-control');
      await expect.element(control).toHaveTextContent(account.accountLabel);
      await expect.poll(() => control.element().getAttribute('title')).toBe(account.accountLabel);

      await openAppMenu(screen);

      const rows = [...page.getByRole('menu').element().children].map((row) => row.textContent?.trim() ?? '');
      expect(rows.slice(rows.lastIndexOf(''))).toEqual(['', account.accountLabel, ...items]);
      expect(offeredAuthItems()).toEqual(items);
    },
  );

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
});
