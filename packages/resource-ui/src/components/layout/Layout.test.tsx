/*
 * The stylesheet decides which navigation answers at a width, so this test file loads it.
 */
import '@/styles/global.css';
import '@/styles/main.css';

import { beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';

import { odbTokenAtom, sessionCheckedAtom } from '@/components/atoms/auth';
import { chooseClock, chooseSite, clockChoice, openAppMenu } from '@/test/helpers';
import { type RenderResultWithRoute, renderWithRoute } from '@/test/render';

import { Layout } from './Layout';
import { SIDEBAR_MENU_ITEMS } from './SidebarMenu';

const CHILD_ROUTES = SIDEBAR_MENU_ITEMS.map((item) => ({
  path: item.to.slice(1),
  element: <div>{item.label} page</div>,
}));

interface Viewport {
  width: number;
  height: number;
}
const PHONE: Viewport = { width: 390, height: 844 };
const DESKTOP: Viewport = { width: 1024, height: 768 };

interface ShellOptions {
  at?: Viewport;
  route?: string;
}

async function renderShell({
  at = DESKTOP,
  route = '/night?site=GS',
}: ShellOptions = {}): Promise<RenderResultWithRoute> {
  await page.viewport(at.width, at.height);
  return renderWithRoute(<Layout />, {
    route,
    path: '/',
    childRoutes: CHILD_ROUTES,
    initialValues: [
      [odbTokenAtom, null],
      [sessionCheckedAtom, true],
    ],
  });
}

describe(Layout, () => {
  beforeAll(() => {
    document.documentElement.classList.add('dark');
  });

  it('should open every destination from the phone bar when at phone width', async () => {
    const screen = await renderShell({ at: PHONE });

    const nav = screen.getByRole('navigation', { name: /primary navigation/i });
    await expect.element(nav).toBeVisible();
    for (const item of SIDEBAR_MENU_ITEMS) {
      await nav.getByRole('link', { name: item.label, exact: true }).click();
      await expect.element(screen.getByText(`${item.label} page`)).toBeVisible();
      await expect
        .element(nav.getByRole('link', { name: item.label, exact: true }))
        .toHaveAttribute('aria-current', 'page');
    }
  });

  it('should keep the masthead selections and the menu operable when at phone width', async () => {
    const screen = await renderShell({ at: PHONE, route: '/night?site=GS&night=2026-11-14' });

    await chooseSite(screen, 'GN');
    await expect.poll(() => screen.router.location.search).toContain('site=GN');
    await chooseClock(screen, 'UTC');
    await openAppMenu(screen);
    await expect.element(clockChoice('UTC')).toHaveAttribute('aria-checked', 'true');
  });

  it('should expose exactly one Primary navigation to assistive tech when at either width', async () => {
    const screen = await renderShell({ at: PHONE });
    const nav = screen.getByRole('navigation', { name: 'Primary navigation', exact: true });
    await expect.poll(() => nav.elements().length).toBe(1);
    expect(nav.element()).toBe(screen.container.querySelector('.xp-bottomnav'));

    await page.viewport(DESKTOP.width, DESKTOP.height);
    await expect.poll(() => nav.elements().length).toBe(1);
    expect(nav.element()).toBe(screen.container.querySelector('aside nav'));
  });
});
