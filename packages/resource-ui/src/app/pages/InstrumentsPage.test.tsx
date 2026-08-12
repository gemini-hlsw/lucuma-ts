/**
 * The instrument browser, against the served workbook data.
 *
 * The night is pinned in the route, never taken from the wall clock: the GN
 * `Alopeke visitor run of late September 2026 is the one served span with no
 * port, which is the case this page exists for.
 */
import { describe, expect, it } from 'vitest';

import { openDropdown, selectDropdownOption } from '@/test/helpers';
import { renderApp } from '@/test/renderApp';

import InstrumentsPage from './InstrumentsPage';

const open = async (route: string) => renderApp({ element: <InstrumentsPage />, route });

describe('InstrumentsPage', () => {
  it('lists the site catalog with where each instrument is tonight', async () => {
    const screen = await open('/instruments?site=GN&semester=2026B&night=2026-09-26');

    await expect.element(screen.getByText('GNIRS')).toBeVisible();
    await expect.element(screen.getByText('Port 3')).toBeVisible();
  });

  it('shows an off-port run as on no port, never inventing a place for it', async () => {
    // The whole reason this page exists: the schedule views draw ports only,
    // so a visitor between mounts is invisible there.
    const screen = await open('/instruments?site=GN&semester=2026B&night=2026-09-26');

    await expect.element(screen.getByText("'Alopeke").first()).toBeVisible();
    await expect.element(screen.getByText('Not on a port').first()).toBeVisible();
  });

  it('says nothing is recorded rather than reading an absence as unavailable', async () => {
    // IGRINS-2 is off Port 1 in late September 2026 - MAROON-X has it - so
    // the night holds no record for it at all.
    const screen = await open('/instruments?site=GN&semester=2026B&night=2026-09-26');

    await expect.element(screen.getByText('Not recorded')).toBeVisible();
  });

  it('opens a row into the instrument runs, showing a usability window', async () => {
    const screen = await open('/instruments?site=GN&semester=2026B&night=2026-09-26');

    await screen.getByRole('button', { name: /expand GNIRS/i }).click();

    const runs = screen.getByTestId('instrument-runs');
    await expect.element(runs).toBeVisible();
    // The workbook records GNIRS Not Available 6-17 August 2026; the run split
    // is exactly what the browser is for.
    await expect.element(runs.getByText('Not available')).toBeVisible();
  });

  it('search narrows across the tag and the published name', async () => {
    const screen = await open('/instruments?site=GN&semester=2026B&night=2026-09-26');
    await expect.element(screen.getByText('GNIRS')).toBeVisible();

    await screen.getByLabelText('Search instruments').fill('maroon');

    await expect.element(screen.getByText('Maroon-X').first()).toBeVisible();
    await expect.element(screen.getByText('GNIRS')).not.toBeInTheDocument();
  });

  it('is a sendable link: the search comes from the URL', async () => {
    const screen = await open('/instruments?site=GN&semester=2026B&night=2026-09-26&q=gnirs');

    await expect.element(screen.getByText('GNIRS')).toBeVisible();
    await expect.element(screen.getByText('Maroon-X').first()).not.toBeInTheDocument();
  });

  it('holds every instrument the site has recorded, not just this semester', async () => {
    // Zorro sits out GS 2025B entirely but is a Gemini South instrument - a
    // browser scoped to the semester would answer "where is Zorro" with
    // silence.
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

    // Ports, then the places an instrument is stored, then the two plain
    // facts - AcqCam and NIRI are both shelved at GN on this night.
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
    // lucuma-core enumerates instruments the workbook never schedules; without
    // them the browser would answer "where is NIRI" with silence. They carry a
    // storage place, never a port, which is what keeps them off the charts.
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
    // A Gemini North instrument has no business in the South's browser.
    await expect.element(screen.getByText('GNIRS')).not.toBeInTheDocument();
  });
});
