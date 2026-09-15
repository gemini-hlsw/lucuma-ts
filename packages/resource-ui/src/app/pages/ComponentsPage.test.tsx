import { ApolloLink } from '@apollo/client';
import { Observable } from '@apollo/client/utilities';
import type { PublishedSemestersQuery } from '@gql/gen/graphql';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';

import { openDropdown, selectDropdownOption } from '@/test/helpers';
import { createMockApollo } from '@/test/mockClient';
import { renderApp } from '@/test/renderApp';

import ComponentsPage from './ComponentsPage';

const open = async (route: string) => renderApp({ element: <ComponentsPage />, route });

/**
 * A real GS semester and a demo one a gap away from it, so a night in the gap has a "nearest"
 * semester (the demo one) that must not lend it a flag `semesterHolding` says the night is not in.
 */
const GS_SEMESTER_WITH_DISTANT_DEMO: PublishedSemestersQuery = {
  publishedSemesters: [
    {
      __typename: 'PublishedSemester',
      site: 'GS',
      semester: '2025B',
      title: 'Gemini South Semester 2025B',
      version: null,
      demo: false,
      holidays: [],
      nights: { __typename: 'DateInterval', start: '2025-08-02', end: '2026-02-02' },
      moonEvents: [],
    },
    {
      __typename: 'PublishedSemester',
      site: 'GS',
      semester: '2026B',
      title: 'Gemini South Semester 2026B',
      version: null,
      demo: true,
      holidays: [],
      nights: { __typename: 'DateInterval', start: '2026-08-02', end: '2027-02-02' },
      moonEvents: [],
    },
  ],
};

const withDistantDemoSemester = () =>
  createMockApollo(
    new ApolloLink((operation, forward) =>
      operation.operationName === 'PublishedSemesters'
        ? new Observable((observer) => {
            observer.next({ data: GS_SEMESTER_WITH_DISTANT_DEMO });
            observer.complete();
          })
        : forward(operation),
    ),
  );

describe('ComponentsPage - the finder', () => {
  it('lists the site catalog with identity, one row per piece', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-10-15');

    await expect.element(screen.getByText('Mask GS2026B-011')).toBeVisible();
    await expect.element(screen.getByText(/barcode 11002801/)).toBeVisible();
  });

  it('says where an installed piece is by joining its instrument - port and name', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-10-15');

    // The g filter rides with GMOS-S, mounted on Port 3 all semester.
    await expect.element(screen.getByText('Port 3 · GMOS-S').first()).toBeVisible();
  });

  it('names the storage place for a spare', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-10-15');

    await expect.element(screen.getByText('Summit lab').first()).toBeVisible();
    await expect.element(screen.getByText('Base facility').first()).toBeVisible();
  });

  it('search narrows across name, code, barcode and alias', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-10-15');
    await expect.element(screen.getByText('Mask GS2026B-011')).toBeVisible();

    await screen.getByLabelText('Search').fill('the long mask');

    await expect.element(screen.getByText('Mask GS2026B-012')).toBeVisible();
    await expect.element(screen.getByText('Mask GS2026B-011')).not.toBeInTheDocument();
  });

  it('is a sendable link: the filters come from the URL', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-10-15&q=the+long+mask&instrument=GMOS');

    await expect.element(screen.getByText('Mask GS2026B-012')).toBeVisible();
    await expect.element(screen.getByText('Mask GS2026B-011')).not.toBeInTheDocument();
    // The controls show the linked state, so refining it starts from there.
    await expect.element(screen.getByLabelText('Search')).toHaveValue('the long mask');
  });

  /* `in` answers true for every `Object.prototype` key, so an unguarded lookup would show All over nothing. */
  it('reads instrument=toString as no filter at all, not as a filter matching nothing', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-10-15&instrument=toString');

    await expect.element(screen.getByText('Mask GS2026B-011')).toBeVisible();
    await expect.element(screen.getByText('K-short').first()).toBeVisible();
  });

  it('reads instrument=constructor as no filter at all', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-10-15&instrument=constructor');

    await expect.element(screen.getByText('Mask GS2026B-011')).toBeVisible();
    await expect.element(screen.getByText('K-short').first()).toBeVisible();
  });

  it('guards the type filter the same way - both maps are plain objects', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-10-15&type=hasOwnProperty');

    // An FPU and a disperser: both types survive, so nothing was filtered.
    await expect.element(screen.getByText('Mask GS2026B-011')).toBeVisible();
    await expect.element(screen.getByText('B1200').first()).toBeVisible();
  });

  // One render per test: a second overlaps act() calls and corrupts the container bookkeeping.
  it('shows the failing piece installed before its failure', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-09-01');
    await screen.getByLabelText('Search').fill('R400');

    await expect.element(screen.getByRole('row', { name: /R400/ }).getByText('Port 3 · GMOS-S')).toBeVisible();
  });

  it('shows the failing piece in the lab after its failure, with the reason on the row', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-12-15');
    await screen.getByLabelText('Search').fill('R400');

    const row = screen.getByRole('row', { name: /R400/ });
    await expect.element(row.getByText('Summit lab')).toBeVisible();
    // Red is reserved for a piece actually out of service, and the record's own words say why.
    await expect.element(row.getByText('Unavailable')).toBeVisible();
    await expect.element(row.getByText('Failed; removed for repair')).toBeVisible();
  });

  it('gives the record its own Note column rather than tucking it under the status', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-12-15');
    await screen.getByLabelText('Search').fill('R400');

    const table = screen.getByTestId('component-table');
    await expect.element(table.getByRole('columnheader', { name: 'Note' })).toBeVisible();
    await expect.element(table.getByText('Failed; removed for repair')).toBeVisible();

    const status = table.getByText('Unavailable').element().closest('td');
    const note = table.getByText('Failed; removed for repair').element().closest('td');
    expect(note).not.toBe(status);
    expect(status?.textContent).toBe('Unavailable');
  });

  it('says a stored piece with nothing wrong is a spare, not broken', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-12-15');
    await screen.getByLabelText('Search').fill('R831');

    const row = screen.getByRole('row', { name: /R831/ });
    await expect.element(row.getByText('Spare')).toBeVisible();
    await expect.element(row.getByText('Unavailable')).not.toBeInTheDocument();
  });

  it('groups the catalog by instrument instead of repeating an Instrument column', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-10-15');

    await expect.element(screen.getByText('pieces', { exact: false }).first()).toBeVisible();
    await expect.element(screen.getByText('on telescope', { exact: false }).first()).toBeVisible();
    await expect.element(screen.getByRole('columnheader', { name: 'Instrument' })).not.toBeInTheDocument();
  });

  it('opens a row into the piece history, phrased in evening dates', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-12-15');
    await screen.getByLabelText('Search').fill('R400');

    // PrimeReact labels the toggler with the row's dataKey.
    await screen.getByRole('button', { name: /expand k-gs-R400_G5325/i }).click();

    const history = screen.getByTestId('component-history');
    await expect.element(history).toBeVisible();
    await expect.element(history.getByText('Failed; removed for repair').first()).toBeVisible();
  });

  it('carries the whole site record, not the semester the masthead happens to show', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-12-15');
    await screen.getByLabelText('Search').fill('R400');
    await screen.getByRole('button', { name: /expand k-gs-R400_G5325/i }).click();

    // Scoped to 2025B the history would say nothing about the cut; a piece's story spans the record.
    const history = screen.getByTestId('component-history');
    await expect.element(history.getByText(/23 Aug 2024/).first()).toBeVisible();
    await expect.element(history.getByText(/31 Jul 2026/).first()).toBeVisible();
  });

  it('heads the history with its columns, so a reader need not infer them from position', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-12-15');
    await screen.getByLabelText('Search').fill('R400');
    await screen.getByRole('button', { name: /expand k-gs-R400_G5325/i }).click();

    const history = screen.getByTestId('component-history');
    for (const column of ['Dates', 'Nights', 'Location', 'Status', 'Note']) {
      await expect.element(history.getByRole('columnheader', { name: column })).toBeVisible();
    }
  });

  it('says where "Installed" was, resolving the span against the same mountings the row uses', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-12-15');
    await screen.getByLabelText('Search').fill('R400');
    await screen.getByRole('button', { name: /expand k-gs-R400_G5325/i }).click();

    // The block only says INSTALLED; the port comes from the mountings already in hand.
    const history = screen.getByTestId('component-history');
    await expect.element(history.getByText('Port 3 · GMOS-S').first()).toBeVisible();
    await expect.element(history.getByText('Installed')).not.toBeInTheDocument();
  });

  it('counts the nights a record covers, which is what "how long was it out" asks', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-12-15');
    await screen.getByLabelText('Search').fill('R400');
    await screen.getByRole('button', { name: /expand k-gs-R400_G5325/i }).click();

    // The 2025B failure runs 19 Nov 2025 - 31 Jan 2026, both evenings counted.
    const history = screen.getByTestId('component-history');
    await expect.element(history.getByRole('row', { name: /19 Nov 2025 - 31 Jan 2026/ })).toMatchTextContent('74');
  });

  it('speaks the row status vocabulary in the history, never the bare enum', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-12-15');
    await screen.getByLabelText('Search').fill('R400');
    await screen.getByRole('button', { name: /expand k-gs-R400_G5325/i }).click();

    const history = screen.getByTestId('component-history');
    await expect.element(history.getByText('Unavailable').first()).toBeVisible();
    await expect.element(history.getByText('Science').first()).toBeVisible();
    await expect.element(history.getByText(/^(SCIENCE|UNAVAILABLE|ENGINEERING)$/)).not.toBeInTheDocument();
  });

  it('filters by instrument', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-10-15');
    // Both F2 and GSAOI carry a K-short; the instrument filter clears them all.
    await expect.element(screen.getByText('K-short').first()).toBeVisible();

    await selectDropdownOption(screen, 'Instrument', 'GMOS (36)');

    await expect.element(screen.getByText('K-short')).not.toBeInTheDocument();
    await expect.element(screen.getByText('B1200').first()).toBeVisible();
  });

  it('filters by component type', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-10-15');
    await expect.element(screen.getByText('Mask GS2026B-011')).toBeVisible();

    await selectDropdownOption(screen, 'Type', 'Disperser (10)');

    // Masks are FPUs and clear out; the gratings stay.
    await expect.element(screen.getByText('Mask GS2026B-011')).not.toBeInTheDocument();
    await expect.element(screen.getByText('B1200').first()).toBeVisible();
  });

  it('organizes the instrument filter: sorted options carrying their counts', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-10-15');
    await expect.element(screen.getByText('B1200').first()).toBeVisible();

    await openDropdown(screen, 'Instrument');

    await expect.element(page.getByRole('option', { name: /^GHOST \(\d+\)$/ })).toBeVisible();
    const options = [...document.querySelectorAll('[role="option"]')].map((option) => option.textContent ?? '');
    expect(options).toEqual([...options].sort((a, b) => a.localeCompare(b)));
  });

  it('does not wear a distant demo semester’s flag for a night the gap between semesters leaves uncovered', async () => {
    // 2026-07-01 sits in the gap, 32 nights from the demo semester and 150 from the real one - closer
    // to the demo semester, which is exactly where a "nearest published semester" fallback would
    // wrongly borrow its flag instead of reporting that nothing holds this night.
    const screen = await renderApp({
      element: <ComponentsPage />,
      route: '/components?site=GS&night=2026-07-01',
      mock: withDistantDemoSemester(),
    });

    await expect.element(screen.getByTestId('component-table')).toBeVisible();
    await expect.element(screen.getByTestId('synthetic-data-tag')).not.toBeInTheDocument();
  });

  it('flags a night the demo semester actually holds', async () => {
    const screen = await renderApp({
      element: <ComponentsPage />,
      route: '/components?site=GS&night=2026-09-01',
      mock: withDistantDemoSemester(),
    });

    await expect.element(screen.getByTestId('component-table')).toBeVisible();
    await expect.element(screen.getByTestId('synthetic-data-tag')).toBeVisible();
  });
});
