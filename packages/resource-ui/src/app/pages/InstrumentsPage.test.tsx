import { describe, expect, it } from 'vitest';

import { openDropdown, selectDropdownOption } from '@/test/helpers';
import { renderApp } from '@/test/renderApp';

import InstrumentsPage from './InstrumentsPage';

const open = async (route: string) => renderApp({ element: <InstrumentsPage />, route });

describe(InstrumentsPage, () => {
  it('lists the site catalog with where each instrument is tonight', async () => {
    const screen = await open('/instruments?site=GN&semester=2026B&night=2026-09-26');

    await expect.element(screen.getByText('GNIRS')).toBeVisible();
    await expect.element(screen.getByText('Port 3')).toBeVisible();
  });

  it('gives the record its own Note column rather than tucking it under the status', async () => {
    // Under the badge a note starts at a different x on every row, under no heading of its own.
    const screen = await open('/instruments?site=GS&semester=2025B&night=2025-12-15&q=GPI');

    const table = screen.getByTestId('instrument-table');
    await expect.element(table.getByRole('columnheader', { name: 'Note' })).toBeVisible();
    await expect.element(table.getByText('Stored at the base facility')).toBeVisible();

    const status = table.getByText('Not available').element().closest('td');
    const note = table.getByText('Stored at the base facility').element().closest('td');
    expect(note).not.toBe(status);
    expect(status?.textContent).toBe('Not available');
  });

  it('shows an off-port run as on no port, never inventing a place for it', async () => {
    // The whole reason this page exists: the schedule views draw ports only.
    const screen = await open('/instruments?site=GN&semester=2026B&night=2026-09-26');

    await expect.element(screen.getByText("'Alopeke").first()).toBeVisible();
    await expect.element(screen.getByText('Not on a port').first()).toBeVisible();
  });

  it('says nothing is recorded rather than reading an absence as unavailable', async () => {
    // IGRINS-2 is off Port 1 in late September 2026, so the night holds no record for it.
    const screen = await open('/instruments?site=GN&semester=2026B&night=2026-09-26');

    await expect.element(screen.getByText('Not recorded')).toBeVisible();
  });

  it('opens a row into the instrument runs, showing a usability window', async () => {
    const screen = await open('/instruments?site=GN&semester=2026B&night=2026-09-26');

    await screen.getByRole('button', { name: /expand GNIRS/i }).click();

    const runs = screen.getByTestId('instrument-runs');
    await expect.element(runs).toBeVisible();
    // The workbook records GNIRS Not Available 6-17 August 2026; the run split is the point.
    await expect.element(runs.getByText('Not available')).toBeVisible();
  });

  it('heads the runs with the same columns whether or not the records fill them', async () => {
    const screen = await open('/instruments?site=GN&semester=2026B&night=2026-09-26&q=gnirs');
    await screen.getByRole('button', { name: /expand GNIRS/i }).click();

    // Two expansions on one page must not disagree about what a column means.
    const runs = screen.getByTestId('instrument-runs');
    for (const column of ['Dates', 'Nights', 'Where', 'Status', 'Note']) {
      await expect.element(runs.getByRole('columnheader', { name: column })).toBeVisible();
    }
  });

  it('counts the nights each run lasted, which is what a run list is read for', async () => {
    const screen = await open('/instruments?site=GN&semester=2026B&night=2026-09-26&q=gnirs');
    await screen.getByRole('button', { name: /expand GNIRS/i }).click();

    // The Not Available window is 6-17 August 2026: twelve nights.
    const runs = screen.getByTestId('instrument-runs');
    await expect.element(runs.getByRole('row', { name: /Not available/ })).toHaveTextContent('12');
  });

  it('search narrows across the tag and the published name', async () => {
    const screen = await open('/instruments?site=GN&semester=2026B&night=2026-09-26');
    await expect.element(screen.getByText('GNIRS')).toBeVisible();

    await screen.getByLabelText('Search').fill('maroon');

    await expect.element(screen.getByText('Maroon-X').first()).toBeVisible();
    await expect.element(screen.getByText('GNIRS')).not.toBeInTheDocument();
  });

  it('is a sendable link: the search comes from the URL', async () => {
    const screen = await open('/instruments?site=GN&semester=2026B&night=2026-09-26&q=gnirs');

    await expect.element(screen.getByText('GNIRS')).toBeVisible();
    await expect.element(screen.getByText('Maroon-X').first()).not.toBeInTheDocument();
  });

  it('holds every instrument the site has recorded, not just this semester', async () => {
    // Zorro sits out GS 2025B but is a GS instrument: a semester-scoped browser would say nothing.
    const screen = await open('/instruments?site=GS&semester=2025B&night=2025-11-20');

    await expect.element(screen.getByText('Zorro').first()).toBeVisible();
    await expect.element(screen.getByText('Not recorded')).toBeVisible();
  });

  it('filters by location, counting what each choice buys', async () => {
    const screen = await open('/instruments?site=GN&semester=2026B&night=2026-09-26');
    await expect.element(screen.getByText('GNIRS')).toBeVisible();

    await selectDropdownOption(screen, 'Location', 'Not on a port');

    await expect.element(screen.getByText("'Alopeke").first()).toBeVisible();
    await expect.element(screen.getByText('GNIRS')).not.toBeInTheDocument();
  });

  it('orders the location choices from the telescope outwards', async () => {
    const screen = await open('/instruments?site=GN&semester=2026B&night=2026-09-26');
    await expect.element(screen.getByText('GNIRS')).toBeVisible();

    await openDropdown(screen, 'Location');

    // AcqCam and NIRI are both shelved at GN on this night.
    const options = [...document.querySelectorAll('[role="option"]')].map((option) => option.textContent ?? '');
    expect(options).toEqual([
      'Port 1 (1)',
      'Port 2 (1)',
      'Port 3 (1)',
      'Port 4 (1)',
      'Port 5 (1)',
      'Summit lab (2)',
      'Not on a port (1)',
      'Not recorded (1)',
    ]);
  });

  it('holds the instruments GPP knows that the schedule never mounts', async () => {
    // The stored layer carries a storage place, never a port, which keeps it off the charts.
    const screen = await open('/instruments?site=GN&semester=2026B&night=2026-09-26');

    await expect.element(screen.getByText('NIRI')).toBeVisible();
    await expect.element(screen.getByText('AcqCam')).toBeVisible();
    await expect.element(screen.getByText('Summit lab').first()).toBeVisible();
  });

  it('filters to a storage place, which is what a stored instrument has instead of a port', async () => {
    const screen = await open('/instruments?site=GS&semester=2025B&night=2025-11-20');

    await selectDropdownOption(screen, 'Location', 'Base facility');

    await expect.element(screen.getByText('GPI')).toBeVisible();
    await expect.element(screen.getByText('GHOST')).not.toBeInTheDocument();
  });

  it('is a sendable link: the location filter comes from the URL', async () => {
    const screen = await open('/instruments?site=GN&semester=2026B&night=2026-09-26&location=Port+3');

    await expect.element(screen.getByText('GNIRS')).toBeVisible();
    await expect.element(screen.getByText('Maroon-X').first()).not.toBeInTheDocument();
  });

  it('answers per site - Gemini South holds its own instruments', async () => {
    const screen = await open('/instruments?site=GS&semester=2025B&night=2025-11-20');

    await expect.element(screen.getByText('GHOST')).toBeVisible();
    await expect.element(screen.getByText('GNIRS')).not.toBeInTheDocument();
  });
});
