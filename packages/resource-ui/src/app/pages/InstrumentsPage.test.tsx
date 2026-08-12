/**
 * The instrument browser, against the served workbook data.
 *
 * The night is pinned in the route, never taken from the wall clock: the GN
 * `Alopeke visitor run of late September 2026 is the one served span with no
 * port, which is the case this page exists for.
 */
import { describe, expect, it } from 'vitest';

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

  it('answers per site - Gemini South holds its own instruments', async () => {
    const screen = await open('/instruments?site=GS&semester=2025B&night=2025-11-20');

    await expect.element(screen.getByText('GHOST')).toBeVisible();
    // A Gemini North instrument has no business in the South's browser.
    await expect.element(screen.getByText('GNIRS')).not.toBeInTheDocument();
  });
});
