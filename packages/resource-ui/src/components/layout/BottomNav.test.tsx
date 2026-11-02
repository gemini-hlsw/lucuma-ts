import { describe, expect, it } from 'vitest';

import { GS_SEMESTER_ROUTE, NAV_LINKS_FROM_GS_SEMESTER } from '@/test/fixtures/navLinks';
import { renderWithRoute } from '@/test/render';

import BottomNav from './BottomNav';
import { SIDEBAR_MENU_ITEMS } from './SidebarMenu';

describe(BottomNav, () => {
  it('offers every destination as a real link in a named landmark', async () => {
    const screen = await renderWithRoute(<BottomNav />, { route: '/semester?site=GN&semester=2026B' });

    await expect.element(screen.getByRole('navigation', { name: /primary navigation/i })).toBeVisible();
    for (const item of SIDEBAR_MENU_ITEMS) {
      await expect.element(screen.getByRole('link', { name: item.label, exact: true })).toHaveAttribute('href');
    }
    expect(SIDEBAR_MENU_ITEMS.length).toBeGreaterThan(0);
  });

  it('carries the site and the night alone, so a view switch keeps the date and drops page state', async () => {
    const screen = await renderWithRoute(<BottomNav />, { route: GS_SEMESTER_ROUTE });

    for (const item of SIDEBAR_MENU_ITEMS) {
      await expect
        .element(screen.getByRole('link', { name: item.label, exact: true }))
        .toHaveAttribute('href', NAV_LINKS_FROM_GS_SEMESTER[item.to]);
    }
  });

  it('marks the current destination as the active one', async () => {
    const screen = await renderWithRoute(<BottomNav />, { route: '/semester?site=GN&semester=2026B' });

    await expect
      .element(screen.getByRole('link', { name: 'Semester', exact: true }))
      .toHaveAttribute('aria-current', 'page');
    await expect.element(screen.getByRole('link', { name: 'Night', exact: true })).not.toHaveAttribute('aria-current');
  });

  it('names every destination in words, never the icon alone', async () => {
    const screen = await renderWithRoute(<BottomNav />, { route: '/night?site=GN' });

    for (const item of SIDEBAR_MENU_ITEMS) {
      await expect.element(screen.getByText(item.label, { exact: true })).toBeVisible();
    }
  });
});
