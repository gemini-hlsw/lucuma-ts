/*
 * The stylesheet decides which navigation answers at a width and whether the bar fits the viewport,
 * so this test file loads it - the one other exception is `chartOverlays.css`.
 */
import '@/styles/global.css';
import '@/styles/main.css';

import { beforeAll, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { fakeJwt, namedUser } from '@/test/factories';
import { chooseClock, chooseSite, openAppMenu } from '@/test/helpers';
import { renderApp } from '@/test/renderApp';
import { contrastRatio, pixelOver, resolvedSize, ROOT_FONT_SIZE } from '@/test/styleProbe';

import Layout from './Layout';
import { SIDEBAR_MENU_SECTIONS } from './SidebarMenu';

const ALL_ITEMS = SIDEBAR_MENU_SECTIONS.flatMap((section) => section.items);
const CHILD_ROUTES = ALL_ITEMS.map((item) => ({ path: item.to.slice(1), element: <div>{item.label} page</div> }));

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1024, height: 768 };
const LONG_NAME = 'Bartholomew Fitzwilliams Oyelaran-Smythe';

async function renderShell(route = '/night?site=GS', token?: string): Promise<Awaited<ReturnType<typeof renderApp>>> {
  return renderApp({ element: <Layout />, route, path: '/', childRoutes: CHILD_ROUTES, token });
}
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
    await page.viewport(PHONE.width, PHONE.height);
    const screen = await renderShell();

    const nav = screen.getByRole('navigation', { name: /primary navigation/i });
    await expect.element(nav).toBeVisible();
    for (const item of ALL_ITEMS) {
      await nav.getByRole('link', { name: item.label, exact: true }).click();
      await expect.element(screen.getByText(`${item.label} page`)).toBeVisible();
      await expect
        .element(nav.getByRole('link', { name: item.label, exact: true }))
        .toHaveAttribute('aria-current', 'page');
    }
  });

  it('keeps the masthead selections and the menu operable at phone width', async () => {
    await page.viewport(PHONE.width, PHONE.height);
    const screen = await renderShell('/night?site=GS&night=2026-11-14');

    await chooseSite(screen, 'GN');
    await expect.poll(() => screen.router.state.location.search).toContain('site=GN');
    await chooseClock(screen, 'UTC');
    await openAppMenu(screen);
    await expect
      .element(page.getByRole('menuitemradio', { name: 'Clock: UTC', exact: true }))
      .toHaveAttribute('aria-checked', 'true');
  });

  it.each([
    [PHONE.width, PHONE.height],
    [320, 568],
  ])('puts nothing past the right edge of a %ix%i viewport', async (width, height) => {
    await page.viewport(width, height);
    const screen = await renderShell();
    await expect.element(screen.getByRole('navigation', { name: /primary navigation/i })).toBeVisible();

    const masthead = screen.container.querySelector('header.xp-masthead');
    expect(masthead).not.toBeNull();
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    expect(masthead!.scrollWidth).toBe(masthead!.clientWidth);
  });

  it.each([
    [PHONE.width, PHONE.height],
    [DESKTOP.width, DESKTOP.height],
  ])('says the build is not production at %ix%i, whole and in view', async (width, height) => {
    await page.viewport(width, height);
    const screen = await renderShell();

    const banner = screen.getByTestId('env-banner');
    await expect.element(banner).toBeVisible();
    const element = banner.element() as HTMLElement;
    expect(element.innerText.trim()).toBe('DEVELOPMENT');
    const box = element.getBoundingClientRect();
    expect(box.left).toBe(0);
    expect(box.right).toBe(window.innerWidth);
  });

  it('sets the banner text to whatever the Dense token resolves to at the root', async () => {
    const screen = await renderShell();

    const banner = screen.getByTestId('env-banner').element() as HTMLElement;
    expect(getComputedStyle(banner).fontSize).toBe(resolvedSize('--text-xs'));
  });

  it('sets the sidebar links to whatever the Dense token resolves to at the root', async () => {
    await page.viewport(DESKTOP.width, DESKTOP.height);
    const screen = await renderShell();

    const link = screen.getByRole('link', { name: ALL_ITEMS[0]!.label, exact: true }).element() as HTMLElement;
    expect(getComputedStyle(link).fontSize).toBe(resolvedSize('--text-xs'));
  });

  it('sets the masthead right cluster to whatever the Dense token resolves to at the root', async () => {
    await page.viewport(DESKTOP.width, DESKTOP.height);
    const screen = await renderShell();

    const cluster = screen.container.querySelector<HTMLElement>('.xp-masthead-right')!;
    expect(getComputedStyle(cluster).fontSize).toBe(resolvedSize('--text-xs'));
  });

  it('keeps the banner ink readable against its own composited fill', async () => {
    await page.viewport(DESKTOP.width, DESKTOP.height);
    const screen = await renderShell();

    const banner = screen.container.querySelector<HTMLElement>('.xp-env-banner')!;
    const style = getComputedStyle(banner);
    const fill = pixelOver(style.backgroundColor, getComputedStyle(document.body).backgroundColor);
    const ink = pixelOver(style.color, `rgb(${fill[0]} ${fill[1]} ${fill[2]})`);

    expect(contrastRatio(ink, fill)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the focus ring readable against the fill it lands on', async () => {
    await page.viewport(PHONE.width, PHONE.height);
    const screen = await renderShell();

    const bar = screen.container.querySelector('.xp-bottomnav')!;
    const active = bar.querySelector<HTMLElement>('a[aria-current="page"]')!;
    await userEvent.tab();
    active.focus();
    expect(active.matches(':focus-visible')).toBe(true);
    const ring = /rgba?\([^)]*\)(?=[^,]*inset)/.exec(getComputedStyle(active).boxShadow)?.[0];
    expect(ring).toBeDefined();

    const barBackground = getComputedStyle(bar).backgroundColor;
    const fill = pixelOver(getComputedStyle(active).backgroundColor, barBackground);
    expect(contrastRatio(pixelOver(ring!, barBackground), fill)).toBeGreaterThanOrEqual(3);
  });

  it('keeps every destination named under reader text spacing at 320px', async () => {
    await page.viewport(320, 568);
    const screen = await renderShell();

    const labels = [...screen.container.querySelectorAll<HTMLElement>('.xp-bottomnav-item > span')];
    expect(labels).toHaveLength(ALL_ITEMS.length);
    for (const label of labels) {
      label.style.letterSpacing = '0.12em';
      label.style.wordSpacing = '0.16em';
      label.style.lineHeight = '1.5';
      expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth);
    }
  });

  it('gives the menu button the widest target the pinned bar allows', async () => {
    await page.viewport(PHONE.width, PHONE.height);
    const screen = await renderShell();

    const menu = screen.getByRole('button', { name: 'Menu' }).element().getBoundingClientRect();
    const masthead = screen.container.querySelector('header.xp-masthead')!;
    expect(menu.width).toBe(44);
    expect(menu.height).toBeCloseTo(masthead.getBoundingClientRect().height, 0);
  });

  it('gives every app-menu row one height, the way Explore does', async () => {
    await page.viewport(DESKTOP.width, DESKTOP.height);
    const screen = await renderShell();
    await openAppMenu(screen);

    const heights = [...page.getByRole('menu').element().children]
      .filter((row) => row.getAttribute('role') !== 'separator')
      .map((row) => row.getBoundingClientRect().height);
    expect(heights.length).toBeGreaterThan(3);
    expect(new Set(heights).size).toBe(1);
  });

  it('dims an app-menu glyph at rest and brightens it with its row', async () => {
    await page.viewport(DESKTOP.width, DESKTOP.height);
    const screen = await renderShell();
    await openAppMenu(screen);
    const row = page.getByRole('menuitemradio', { name: 'Clock: Site time', exact: true }).element();
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
    await page.viewport(PHONE.width, PHONE.height);
    const screen = await renderShell();

    const { sidebar, bottom } = navigations(screen.container);
    expect(bottom).toBeVisible();
    expect(sidebar).not.toBeVisible();
  });

  it('shows the sidebar and no phone bar at `md` and up', async () => {
    await page.viewport(DESKTOP.width, DESKTOP.height);
    const screen = await renderShell();

    const { sidebar, bottom } = navigations(screen.container);
    expect(sidebar).toBeVisible();
    expect(bottom).not.toBeVisible();
    for (const item of ALL_ITEMS) {
      await expect.element(screen.getByRole('link', { name: item.label, exact: true })).toBeVisible();
    }
  });

  it.each([
    [PHONE.width, PHONE.height],
    [DESKTOP.width, DESKTOP.height],
  ])('keeps the site on the wordmark s own row at %ix%i', async (width, height) => {
    await page.viewport(width, height);
    const screen = await renderShell();

    const brand = screen.getByRole('link', { name: 'Resource', exact: false }).element().getBoundingClientRect();
    const site = screen.getByRole('group', { name: 'Site' }).element().getBoundingClientRect();
    expect(site.top).toBeLessThan(brand.bottom);
    expect(site.bottom).toBeGreaterThan(brand.top);
  });

  it('exposes exactly one Primary navigation to assistive tech at either width', async () => {
    await page.viewport(PHONE.width, PHONE.height);
    const screen = await renderShell();
    const nav = screen.getByRole('navigation', { name: 'Primary navigation', exact: true });
    await expect.poll(() => nav.elements().length).toBe(1);
    expect(nav.element()).toBe(screen.container.querySelector('.xp-bottomnav'));

    await page.viewport(DESKTOP.width, DESKTOP.height);
    await expect.poll(() => nav.elements().length).toBe(1);
    expect(nav.element()).toBe(screen.container.querySelector('aside nav'));
  });

  it('moves the account name into the menu below `md`, keeping it announced in the bar', async () => {
    await page.viewport(PHONE.width, PHONE.height);
    const screen = await renderShell();

    const account = screen.getByTestId('account-control').element();
    const name = [...account.querySelectorAll('span')].find((span) => span.textContent === 'Not signed in');
    expect(name).toBeDefined();
    expect(getComputedStyle(name!).display).not.toBe('none');
    expect(name!.getBoundingClientRect().width).toBeLessThanOrEqual(2);

    await screen.getByRole('button', { name: 'Menu' }).click();
    await expect.element(page.getByRole('menu').getByText('Not signed in', { exact: true })).toBeVisible();
  });

  it.each([
    [320, 568],
    [PHONE.width, PHONE.height],
    [768, 1024],
    [DESKTOP.width, DESKTOP.height],
  ])('keeps the bar inside a %ix%i viewport with a long name signed in', async (width, height) => {
    await page.viewport(width, height);
    const screen = await renderShell('/night?site=GS', fakeJwt(namedUser(LONG_NAME)));

    await expect.element(screen.getByTestId('account-control')).toHaveAttribute('title', LONG_NAME);
    const masthead = screen.container.querySelector('header.xp-masthead')!;
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    expect(masthead.scrollWidth).toBe(masthead.clientWidth);
  });

  it('gives a long name an ellipsis rather than letting it push the menu off the bar', async () => {
    await page.viewport(DESKTOP.width, DESKTOP.height);
    const screen = await renderShell('/night?site=GS', fakeJwt(namedUser(LONG_NAME)));

    const name = screen.container.querySelector<HTMLElement>('.xp-account-name')!;
    expect(getComputedStyle(name).textOverflow).toBe('ellipsis');
    expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);
  });

  it('shows the account name on the bar at `md` and up, and heads the menu with it too', async () => {
    await page.viewport(DESKTOP.width, DESKTOP.height);
    const screen = await renderShell();

    const account = screen.getByTestId('account-control').element();
    const name = [...account.querySelectorAll('span')].find((span) => span.textContent === 'Not signed in');
    expect(name).toBeDefined();
    expect(name!.getBoundingClientRect().width).toBeGreaterThan(10);
    await openAppMenu(screen);
    await expect.element(page.getByRole('menu').getByText('Not signed in', { exact: true })).toBeVisible();
  });
});
