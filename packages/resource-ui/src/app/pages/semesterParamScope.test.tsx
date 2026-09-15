/**
 * The `semester` parameter belongs to /semester. A link minted there carries it everywhere, so what
 * matters is that nowhere else reads it: these pages must render identically with and without one.
 */
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import Sidebar from '@/components/layout/Sidebar';
import { renderApp } from '@/test/renderApp';

import ComponentsPage from './ComponentsPage';
import InstrumentsPage from './InstrumentsPage';
import NightPage from './NightPage';
import WeekPage from './WeekPage';

const NIGHT = '2025-11-14';

describe('the semester parameter outside /semester', () => {
  it('leaves the night where the night parameter put it, whatever semester is named', async () => {
    const stale = await renderApp({ element: <NightPage />, route: `/night?site=GS&night=${NIGHT}&semester=2024B` });

    // 2024B does not hold this night; the page still reports the night it was asked for,
    // and names the semester that really holds it.
    await expect.element(stale.getByText(`Night of ${NIGHT}`)).toBeVisible();
    await expect.element(stale.getByRole('link', { name: /2025B/ })).toBeVisible();
  });

  it('opens the same week with a stale semester as without one', async () => {
    const plain = await renderApp({ element: <WeekPage />, route: `/week?site=GS&night=${NIGHT}` });
    const heading = plain.getByRole('heading', { level: 1 }).element().textContent;
    await plain.unmount();

    const stale = await renderApp({ element: <WeekPage />, route: `/week?site=GS&night=${NIGHT}&semester=2099Z` });

    await expect.poll(() => stale.getByRole('heading', { level: 1 }).element().textContent).toBe(heading);
  });

  it('scopes the finders to the site and the night, never to a semester', async () => {
    // The finders report the site's whole record, so a semester in the URL must change nothing at all.
    const pages = [
      { element: <InstrumentsPage />, testId: 'instrument-table' },
      { element: <ComponentsPage />, testId: 'component-table' },
    ];

    for (const { element, testId } of pages) {
      const rendered = async (search: string): Promise<string> => {
        const screen = await renderApp({ element, route: `/finder?site=GS&night=${NIGHT}${search}` });
        const table = screen.getByTestId(testId);
        await expect.element(table).toBeVisible();
        const text = table.element().textContent ?? '';
        expect(text).not.toBe('');
        await screen.unmount();
        return text;
      };

      expect(await rendered('&semester=2024B')).toBe(await rendered(''));
    }
  });
});

/** A page-scoped filter is one page's; nothing carries it to a destination that never asked for it. */
describe('a finder filter carried by a navigation link', () => {
  function InstrumentsWithNav(): JSX.Element {
    return (
      <>
        <Sidebar />
        <InstrumentsPage />
      </>
    );
  }

  it('does not reach the other finder', async () => {
    const screen = await renderApp({
      element: <InstrumentsWithNav />,
      route: `/instruments?site=GS&night=${NIGHT}&q=GPI`,
      extraRoutes: [{ path: '/components', element: <ComponentsPage /> }],
    });

    await expect.element(screen.getByTestId('instrument-table')).toBeVisible();
    await expect.element(screen.getByLabelText('Search', { exact: true })).toHaveValue('GPI');

    await screen.getByRole('link', { name: 'Components', exact: true }).click();

    await expect.element(screen.getByTestId('component-table')).toBeVisible();
    await expect.element(screen.getByLabelText('Search', { exact: true })).toHaveValue('');
    await expect.poll(() => screen.router.state.location.search).not.toContain('q=GPI');
  });
});
