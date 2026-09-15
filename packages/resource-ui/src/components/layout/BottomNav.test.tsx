import { describe, expect, it } from 'vitest';

import { renderApp } from '@/test/renderApp';

import BottomNav from './BottomNav';
import { SIDEBAR_MENU_SECTIONS } from './SidebarMenu';

const ALL_ITEMS = SIDEBAR_MENU_SECTIONS.flatMap((section) => section.items);

describe(BottomNav, () => {
  it('offers every destination as a real link in a named landmark', async () => {
    const screen = await renderApp({ element: <BottomNav />, route: '/semester?site=GN&semester=2026B' });

    await expect.element(screen.getByRole('navigation', { name: /primary navigation/i })).toBeVisible();
    for (const item of ALL_ITEMS) {
      await expect.element(screen.getByRole('link', { name: item.label, exact: true })).toHaveAttribute('href');
    }
    expect(ALL_ITEMS.length).toBeGreaterThan(0);
  });

  it('carries the site and the night alone, so a view switch keeps the date and drops page state', async () => {
    const screen = await renderApp({
      element: <BottomNav />,
      route: '/semester?site=GS&semester=2026B&night=2026-09-14&view=calendar',
    });

    for (const item of ALL_ITEMS) {
      await expect
        .element(screen.getByRole('link', { name: item.label, exact: true }))
        .toHaveAttribute('href', `${item.to}?site=GS&night=2026-09-14`);
    }
  });

  it('marks the current destination as the active one', async () => {
    const screen = await renderApp({ element: <BottomNav />, route: '/semester?site=GN&semester=2026B' });

    await expect
      .element(screen.getByRole('link', { name: 'Semester', exact: true }))
      .toHaveAttribute('aria-current', 'page');
    await expect.element(screen.getByRole('link', { name: 'Night', exact: true })).not.toHaveAttribute('aria-current');
  });

  it('names every destination in words, never the icon alone', async () => {
    const screen = await renderApp({ element: <BottomNav />, route: '/night?site=GN' });

    for (const item of ALL_ITEMS) {
      await expect.element(screen.getByText(item.label, { exact: true })).toBeVisible();
    }
  });
});
