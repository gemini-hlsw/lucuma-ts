import { describe, expect, it } from 'vitest';

import { renderApp } from '@/test/renderApp';

import Sidebar from './Sidebar';
import { SIDEBAR_MENU_SECTIONS } from './SidebarMenu';

const ALL_ITEMS = SIDEBAR_MENU_SECTIONS.flatMap((section) => section.items);

// Driven by the menu, so a new destination needs no rewrite of these guards.
describe(Sidebar, () => {
  it('offers every destination as a real link in a named landmark', async () => {
    const screen = await renderApp({ element: <Sidebar />, route: '/semester?site=GN&semester=2026B' });

    await expect.element(screen.getByRole('navigation', { name: /primary navigation/i })).toBeVisible();
    for (const item of ALL_ITEMS) {
      await expect.element(screen.getByRole('link', { name: item.label, exact: true })).toHaveAttribute('href');
    }
    expect(ALL_ITEMS.length).toBeGreaterThan(0);
  });

  it('carries the selection across a view switch, so changing view never moves the date', async () => {
    const search = '?site=GS&semester=2026B&night=2026-09-14&tz=UTC';
    const screen = await renderApp({ element: <Sidebar />, route: `/semester${search}` });

    for (const item of ALL_ITEMS) {
      await expect
        .element(screen.getByRole('link', { name: item.label, exact: true }))
        .toHaveAttribute('href', `${item.to}${search}`);
    }
  });

  it('gates nothing - every view stays reachable on a semester with no schedule', async () => {
    // Gating navigation on whether a schedule exists strands the reader on one view.
    const screen = await renderApp({ element: <Sidebar />, route: '/semester?site=GN&semester=2029A' });

    for (const item of ALL_ITEMS) {
      await expect.element(screen.getByRole('link', { name: item.label, exact: true })).toBeVisible();
    }
  });

  it('marks the current destination as the active one', async () => {
    const screen = await renderApp({ element: <Sidebar />, route: '/semester?site=GN&semester=2026B' });

    await expect
      .element(screen.getByRole('link', { name: 'Semester', exact: true }))
      .toHaveAttribute('aria-current', 'page');
  });

  it('carries no authoring destination - Resource does not build schedules here', async () => {
    const screen = await renderApp({ element: <Sidebar />, route: '/semester?site=GN&semester=2026B' });

    for (const gone of ['Schedules', 'Overview', 'Plan', 'Review', 'History', 'Editor', 'Issues', 'Scenarios']) {
      await expect.element(screen.getByRole('link', { name: gone, exact: true })).not.toBeInTheDocument();
    }
  });
});

describe('the data-source note', () => {
  it('names the live endpoint, so no page reads without knowing where it came from', async () => {
    const screen = await renderApp({ element: <Sidebar />, route: '/night' });

    const note = screen.getByTestId('data-source-note');
    await expect.element(note).toBeVisible();
    await expect.element(note.getByText('/resource/graphql')).toBeVisible();
  });
});
