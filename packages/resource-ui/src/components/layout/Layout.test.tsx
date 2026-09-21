/*
 * The stylesheet decides which navigation answers at a width and whether the bar fits the viewport,
 * so this test file loads it - the one other exception is `chartOverlays.css`.
 */
import '@/styles/global.css';
import '@/styles/main.css';

import { beforeAll, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { chooseClock, chooseSite, openAppMenu } from '@/test/helpers';
import { renderApp } from '@/test/renderApp';
import { contrastRatio, pixelOver, resolvedSize, ROOT_FONT_SIZE } from '@/test/styleProbe';

import Layout from './Layout';
import { SIDEBAR_MENU_SECTIONS } from './SidebarMenu';

const ALL_ITEMS = SIDEBAR_MENU_SECTIONS.flatMap((section) => section.items);

/** Stand-in pages: the subject is the shell, not what each view does with its own width. */
const CHILD_ROUTES = ALL_ITEMS.map((item) => ({ path: item.to.slice(1), element: <div>{item.label} page</div> }));

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1024, height: 768 };

async function renderShell(route = '/night?site=GS'): Promise<Awaited<ReturnType<typeof renderApp>>> {
  return renderApp({ element: <Layout />, route, path: '/', childRoutes: CHILD_ROUTES });
}

/** The two navigations share a name because only one is ever exposed; the class holds both at once. */
function navigations(container: HTMLElement): { sidebar: Element; bottom: Element } {
  const sidebar = container.querySelector('aside');
  const bottom = container.querySelector('.xp-bottomnav');
  expect(sidebar).not.toBeNull();
  expect(bottom).not.toBeNull();
  return { sidebar: sidebar!, bottom: bottom! };
}

describe(Layout, () => {
  beforeAll(() => {
    // The lucuma-ui theme is scoped under `.dark`, the way `main.tsx` scopes it.
    document.documentElement.classList.add('dark');
  });

  it('leaves the root where the browser put it - DESIGN.md One-Number Rule', () => {
    // An absolute px root would pin every rem and silently disable the reader's own font-size setting.
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

    // The popup renders into document.body, so the helpers reach it through `page`.
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
    // The shell is `overflow-x: hidden`, so anything wider than the viewport is unreachable, not scrollable.
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
    // A full-width strip: no width can clip it, which is what the badge could not promise.
    expect(element.innerText.trim()).toBe('DEVELOPMENT');
    const box = element.getBoundingClientRect();
    expect(box.left).toBe(0);
    expect(box.right).toBe(window.innerWidth);
  });

  it('sets the banner text to whatever the Dense token resolves to at the root', async () => {
    const screen = await renderShell();

    const banner = screen.getByTestId('env-banner').element() as HTMLElement;
    // Dense is the floor below which informative text must take the foreground tone.
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
    // The accent is translucent, so the fill is what it composites to over the page behind it.
    const fill = pixelOver(style.backgroundColor, getComputedStyle(document.body).backgroundColor);
    const ink = pixelOver(style.color, `rgb(${fill[0]} ${fill[1]} ${fill[2]})`);

    expect(contrastRatio(ink, fill)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the focus ring readable against the fill it lands on', async () => {
    await page.viewport(PHONE.width, PHONE.height);
    const screen = await renderShell();

    const bar = screen.container.querySelector('.xp-bottomnav')!;
    const active = bar.querySelector<HTMLElement>('a[aria-current="page"]')!;
    // The ring is a keyboard affordance, and `:focus-visible` follows the last input modality.
    await userEvent.tab();
    active.focus();
    expect(active.matches(':focus-visible')).toBe(true);

    // The ring is the one inset shadow among the focus utilities' layers.
    const ring = /rgba?\([^)]*\)(?=[^,]*inset)/.exec(getComputedStyle(active).boxShadow)?.[0];
    expect(ring).toBeDefined();

    const barBackground = getComputedStyle(bar).backgroundColor;
    const fill = pixelOver(getComputedStyle(active).backgroundColor, barBackground);
    // WCAG 1.4.11: a UI part needs 3:1 against what it sits on, and the active item's fill is that.
    expect(contrastRatio(pixelOver(ring!, barBackground), fill)).toBeGreaterThanOrEqual(3);
  });

  it('keeps every destination named under reader text spacing at 320px', async () => {
    await page.viewport(320, 568);
    const screen = await renderShell();

    const labels = [...screen.container.querySelectorAll<HTMLElement>('.xp-bottomnav-item > span')];
    expect(labels).toHaveLength(ALL_ITEMS.length);
    for (const label of labels) {
      // WCAG 1.4.12: a reader's own spacing must not cost a destination its name.
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
    // The bar, not the glyph, is what caps the height.
    expect(menu.height).toBeCloseTo(masthead.getBoundingClientRect().height, 0);
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

    // Site is identity, so it shares the wordmark's band at every width: one bar, never two rows.
    expect(site.top).toBeLessThan(brand.bottom);
    expect(site.bottom).toBeGreaterThan(brand.top);
  });

  it('exposes exactly one Primary navigation to assistive tech at either width', async () => {
    await page.viewport(PHONE.width, PHONE.height);
    const screen = await renderShell();

    // Two named navs at one width would double-announce; the role query reads the accessibility tree, not pixels.
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
    const name = [...account.querySelectorAll('span')].find((span) => span.textContent === 'Guest User');
    expect(name).toBeDefined();
    // Visually yielded but still in the accessibility tree: sr-only, never `display: none`.
    expect(getComputedStyle(name!).display).not.toBe('none');
    expect(name!.getBoundingClientRect().width).toBeLessThanOrEqual(2);

    await screen.getByRole('button', { name: 'Menu' }).click();
    await expect.element(page.getByRole('menu').getByText('Guest User', { exact: true })).toBeVisible();
  });

  it('shows the account name on the bar at `md` and up, and heads the menu with it too', async () => {
    await page.viewport(DESKTOP.width, DESKTOP.height);
    const screen = await renderShell();

    const account = screen.getByTestId('account-control').element();
    const name = [...account.querySelectorAll('span')].find((span) => span.textContent === 'Guest User');
    expect(name).toBeDefined();
    expect(name!.getBoundingClientRect().width).toBeGreaterThan(10);

    // The menu names its account at every width: with sign-out coming, the header is where it acts.
    await openAppMenu(screen);
    await expect.element(page.getByRole('menu').getByText('Guest User', { exact: true })).toBeVisible();
  });
});
