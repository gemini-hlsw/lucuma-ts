/*
 * The stylesheet decides which navigation answers at a width and whether the bar fits the viewport,
 * so this test file loads it.
 */
import '@/styles/global.css';
import '@/styles/main.css';

import { fakeJwt, namedUser } from '@gemini-hlsw/lucuma-common-ui/testing';
import { beforeAll, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { odbTokenAtom, sessionCheckedAtom } from '@/components/atoms/auth';
import { chooseClock, chooseSite, clockChoice, openAppMenu } from '@/test/helpers';
import { type RenderResultWithRoute, renderWithRoute } from '@/test/render';
import { contrastOn, pixelOver, resolvedSize, ROOT_FONT_SIZE } from '@/test/styleProbe';

import Layout from './Layout';
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
const SMALL_PHONE: Viewport = { width: 320, height: 568 };
const TABLET: Viewport = { width: 768, height: 1024 };
const LONG_NAME = 'Bartholomew Fitzwilliams Oyelaran-Smythe';

interface ShellOptions {
  at?: Viewport;
  route?: string;
  token?: string | null;
}

async function renderShell({
  at = DESKTOP,
  route = '/night?site=GS',
  token = null,
}: ShellOptions = {}): Promise<RenderResultWithRoute> {
  await page.viewport(at.width, at.height);
  return renderWithRoute(<Layout />, {
    route,
    path: '/',
    childRoutes: CHILD_ROUTES,
    initialValues: [
      [odbTokenAtom, token],
      [sessionCheckedAtom, true],
    ],
  });
}
const accountNameSpan = (screen: RenderResultWithRoute): HTMLElement | undefined =>
  [...screen.getByTestId('account-control').element().querySelectorAll('span')].find(
    (span) => span.textContent === 'Not signed in',
  );

function navigations(container: HTMLElement): { sidebar: Element; bottom: Element } {
  const sidebar = container.querySelector('aside');
  const bottom = container.querySelector('.xp-bottomnav');
  expect(sidebar).not.toBeNull();
  expect(bottom).not.toBeNull();
  return { sidebar: sidebar!, bottom: bottom! };
}

describe(Layout, () => {
  beforeAll(() => {
    document.documentElement.classList.add('dark');
  });

  it('leaves the root where the browser put it - DESIGN.md One-Number Rule', () => {
    expect(getComputedStyle(document.documentElement).fontSize).toBe(ROOT_FONT_SIZE);
  });

  it('opens every destination from the phone bar', async () => {
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

  it('keeps the masthead selections and the menu operable at phone width', async () => {
    const screen = await renderShell({ at: PHONE, route: '/night?site=GS&night=2026-11-14' });

    await chooseSite(screen, 'GN');
    await expect.poll(() => screen.router.location.search).toContain('site=GN');
    await chooseClock(screen, 'UTC');
    await openAppMenu(screen);
    await expect.element(clockChoice('UTC')).toHaveAttribute('aria-checked', 'true');
  });

  it.each([[PHONE], [SMALL_PHONE]])(
    'should put nothing past the right edge when the viewport is $width x $height',
    async (at) => {
      const screen = await renderShell({ at });
      await expect.element(screen.getByRole('navigation', { name: /primary navigation/i })).toBeVisible();

      const masthead = screen.container.querySelector('header.xp-masthead');
      expect(masthead).not.toBeNull();
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
      expect(masthead!.scrollWidth).toBe(masthead!.clientWidth);
    },
  );

  it.each([[PHONE], [DESKTOP]])(
    'should say the build is not production, whole and in view, when the viewport is $width x $height',
    async (at) => {
      const screen = await renderShell({ at });

      const banner = screen.getByTestId('env-banner');
      await expect.element(banner).toBeVisible();
      const element = banner.element() as HTMLElement;
      expect(element.innerText.trim()).toBe('DEVELOPMENT');
      const box = element.getBoundingClientRect();
      expect(box.left).toBe(0);
      expect(box.right).toBe(window.innerWidth);
    },
  );

  it('sets the banner text to whatever the Dense token resolves to at the root', async () => {
    const screen = await renderShell();

    const banner = screen.getByTestId('env-banner').element() as HTMLElement;
    expect(getComputedStyle(banner).fontSize).toBe(resolvedSize('--text-xs'));
  });

  it('sets the sidebar links to whatever the Dense token resolves to at the root', async () => {
    const screen = await renderShell();

    const link = screen.getByRole('link', { name: SIDEBAR_MENU_ITEMS[0]!.label, exact: true }).element() as HTMLElement;
    expect(getComputedStyle(link).fontSize).toBe(resolvedSize('--text-xs'));
  });

  it('sets the masthead right cluster to whatever the Dense token resolves to at the root', async () => {
    const screen = await renderShell();

    const cluster = screen.container.querySelector<HTMLElement>('.xp-masthead-right')!;
    expect(getComputedStyle(cluster).fontSize).toBe(resolvedSize('--text-xs'));
  });

  it('keeps the banner ink readable against its own composited fill', async () => {
    const screen = await renderShell();

    const banner = screen.container.querySelector<HTMLElement>('.xp-env-banner')!;
    const style = getComputedStyle(banner);
    const fill = pixelOver(style.backgroundColor, getComputedStyle(document.body).backgroundColor);

    expect(contrastOn(style.color, fill)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the focus ring readable against the fill it lands on', async () => {
    const screen = await renderShell({ at: PHONE });

    const bar = screen.container.querySelector('.xp-bottomnav')!;
    const active = bar.querySelector<HTMLElement>('a[aria-current="page"]')!;
    await userEvent.tab();
    active.focus();
    expect(active.matches(':focus-visible')).toBe(true);
    const ring = /rgba?\([^)]*\)(?=[^,]*inset)/.exec(getComputedStyle(active).boxShadow)?.[0];
    expect(ring).toBeDefined();

    const barBackground = getComputedStyle(bar).backgroundColor;
    const fill = pixelOver(getComputedStyle(active).backgroundColor, barBackground);
    expect(contrastOn(ring!, fill)).toBeGreaterThanOrEqual(3);
  });

  it('keeps every destination named under reader text spacing at 320px', async () => {
    const screen = await renderShell({ at: SMALL_PHONE });

    const labels = [...screen.container.querySelectorAll<HTMLElement>('.xp-bottomnav-item > span')];
    expect(labels).toHaveLength(SIDEBAR_MENU_ITEMS.length);
    for (const label of labels) {
      label.style.letterSpacing = '0.12em';
      label.style.wordSpacing = '0.16em';
      label.style.lineHeight = '1.5';
      expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth);
    }
  });

  it('gives the menu button the widest target the pinned bar allows', async () => {
    const screen = await renderShell({ at: PHONE });

    const menu = screen.getByRole('button', { name: 'Menu' }).element().getBoundingClientRect();
    const masthead = screen.container.querySelector('header.xp-masthead')!;
    expect(menu.width).toBe(44);
    expect(menu.height).toBeCloseTo(masthead.getBoundingClientRect().height, 0);
  });

  it('gives every app-menu row one height, the way Explore does', async () => {
    const screen = await renderShell();
    await openAppMenu(screen);

    const heights = [...page.getByRole('menu').element().children]
      .filter((row) => row.getAttribute('role') !== 'separator')
      .map((row) => row.getBoundingClientRect().height);
    expect(heights.length).toBeGreaterThan(3);
    expect(new Set(heights).size).toBe(1);
  });

  it('dims an app-menu glyph at rest and brightens it with its row', async () => {
    const screen = await renderShell();
    await openAppMenu(screen);
    const row = clockChoice('Site time').element();
    const icon = row.querySelector('svg')!;
    const label = row.querySelector<HTMLElement>('.p-menuitem-text')!;
    const alpha = (colour: string): number => {
      const parts = /^rgba?\(([^)]+)\)$/u.exec(colour)?.[1]?.split(',') ?? [];
      return parts.length === 4 ? Number.parseFloat(parts[3]!) : 1;
    };
    expect(alpha(getComputedStyle(icon).color)).toBeLessThan(alpha(getComputedStyle(label).color));

    await userEvent.hover(row);

    expect(alpha(getComputedStyle(icon).color)).toBe(alpha(getComputedStyle(label).color));
  });

  it('shows the phone bar and no sidebar below `md`', async () => {
    const screen = await renderShell({ at: PHONE });

    const { sidebar, bottom } = navigations(screen.container);
    expect(bottom).toBeVisible();
    expect(sidebar).not.toBeVisible();
  });

  it('shows the sidebar and no phone bar at `md` and up', async () => {
    const screen = await renderShell();

    const { sidebar, bottom } = navigations(screen.container);
    expect(sidebar).toBeVisible();
    expect(bottom).not.toBeVisible();
    for (const item of SIDEBAR_MENU_ITEMS) {
      await expect.element(screen.getByRole('link', { name: item.label, exact: true })).toBeVisible();
    }
  });

  it.each([[PHONE], [DESKTOP]])(
    'should keep the site on the wordmark’s own row when the viewport is $width x $height',
    async (at) => {
      const screen = await renderShell({ at });

      const brand = screen.getByRole('link', { name: 'Resource', exact: false }).element().getBoundingClientRect();
      const site = screen.getByRole('group', { name: 'Site' }).element().getBoundingClientRect();
      expect(site.top).toBeLessThan(brand.bottom);
      expect(site.bottom).toBeGreaterThan(brand.top);
    },
  );

  it('exposes exactly one Primary navigation to assistive tech at either width', async () => {
    const screen = await renderShell({ at: PHONE });
    const nav = screen.getByRole('navigation', { name: 'Primary navigation', exact: true });
    await expect.poll(() => nav.elements().length).toBe(1);
    expect(nav.element()).toBe(screen.container.querySelector('.xp-bottomnav'));

    await page.viewport(DESKTOP.width, DESKTOP.height);
    await expect.poll(() => nav.elements().length).toBe(1);
    expect(nav.element()).toBe(screen.container.querySelector('aside nav'));
  });

  it('moves the account name into the menu below `md`, keeping it announced in the bar', async () => {
    const screen = await renderShell({ at: PHONE });

    const name = accountNameSpan(screen);
    expect(name).toBeDefined();
    expect(getComputedStyle(name!).display).not.toBe('none');
    expect(name!.getBoundingClientRect().width).toBeLessThanOrEqual(2);

    await screen.getByRole('button', { name: 'Menu' }).click();
    await expect.element(page.getByRole('menu').getByText('Not signed in', { exact: true })).toBeVisible();
  });

  it.each([[SMALL_PHONE], [PHONE], [TABLET], [DESKTOP]])(
    'should keep the bar inside the viewport when a long name is signed in at $width x $height',
    async (at) => {
      const screen = await renderShell({ at, token: fakeJwt(namedUser(LONG_NAME)) });

      await expect.element(screen.getByTestId('account-control')).toHaveAttribute('title', LONG_NAME);
      const masthead = screen.container.querySelector('header.xp-masthead')!;
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
      expect(masthead.scrollWidth).toBe(masthead.clientWidth);
    },
  );

  it('gives a long name an ellipsis rather than letting it push the menu off the bar', async () => {
    const screen = await renderShell({ token: fakeJwt(namedUser(LONG_NAME)) });

    const name = screen.container.querySelector<HTMLElement>('.xp-account-name')!;
    expect(getComputedStyle(name).textOverflow).toBe('ellipsis');
    expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);
  });

  it('shows the account name on the bar at `md` and up, and heads the menu with it too', async () => {
    const screen = await renderShell();

    const name = accountNameSpan(screen);
    expect(name).toBeDefined();
    expect(name!.getBoundingClientRect().width).toBeGreaterThan(10);
    await openAppMenu(screen);
    await expect.element(page.getByRole('menu').getByText('Not signed in', { exact: true })).toBeVisible();
  });
});
