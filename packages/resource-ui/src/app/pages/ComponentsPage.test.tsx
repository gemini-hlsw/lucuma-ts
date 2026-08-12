import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';

import { openDropdown, selectDropdownOption } from '@/test/helpers';
import { renderApp } from '@/test/renderApp';

import ComponentsPage from './ComponentsPage';

/**
 * The night is pinned in the route, never taken from the wall clock: the R400
 * failure lands ~60% through GMOS-S's 2025B mounting (late November), so
 * mid-October is before it and mid-December after.
 */
const open = async (route: string) => renderApp({ element: <ComponentsPage />, route });

describe('ComponentsPage - the finder', () => {
  it('lists the site catalog with identity, one row per piece', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-10-15');

    await expect.element(screen.getByText('Mask GS2026B-011')).toBeVisible();
    await expect.element(screen.getByText(/barcode 11002801/)).toBeVisible();
  });

  it('says where an installed piece is by joining its instrument - port and name', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-10-15');

    // The g filter rides with GMOS-S, mounted on Port 3 all semester.
    await expect.element(screen.getByText('Port 3 · GMOS').first()).toBeVisible();
  });

  it('names the storage place for a spare', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-10-15');

    await expect.element(screen.getByText('Summit lab').first()).toBeVisible();
    await expect.element(screen.getByText('Base facility').first()).toBeVisible();
  });

  it('search narrows across name, code, barcode and alias', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-10-15');
    await expect.element(screen.getByText('Mask GS2026B-011')).toBeVisible();

    await screen.getByLabelText('Search components').fill('the long mask');

    await expect.element(screen.getByText('Mask GS2026B-012')).toBeVisible();
    await expect.element(screen.getByText('Mask GS2026B-011')).not.toBeInTheDocument();
  });

  it('is a sendable link: the filters come from the URL', async () => {
    // No typing: the URL alone reproduces a filtered finder.
    const screen = await open('/components?site=GS&semester=2025B&night=2025-10-15&q=the+long+mask&instrument=GMOS');

    await expect.element(screen.getByText('Mask GS2026B-012')).toBeVisible();
    await expect.element(screen.getByText('Mask GS2026B-011')).not.toBeInTheDocument();
    // The controls show the linked state, so refining it starts from there.
    await expect.element(screen.getByLabelText('Search components')).toHaveValue('the long mask');
  });

  // One render per test: a second render in the same test overlaps act() calls
  // and corrupts the container bookkeeping for every test after it.
  it('shows the failing piece installed before its failure', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-09-01');
    await screen.getByLabelText('Search components').fill('R400');

    await expect.element(screen.getByText('Port 3 · GMOS')).toBeVisible();
  });

  it('shows the failing piece in the lab after its failure, with the reason on the row', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-12-15');
    await screen.getByLabelText('Search components').fill('R400');

    await expect.element(screen.getByText('Summit lab')).toBeVisible();
    // Red is reserved for a piece actually out of service, and the record's
    // note rides with the tag - a status that cannot say why is not a status.
    await expect.element(screen.getByText('Unavailable')).toBeVisible();
    await expect.element(screen.getByText('Failed; removed for repair')).toBeVisible();
  });

  it('says a stored piece with nothing wrong is a spare, not broken', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-12-15');
    await screen.getByLabelText('Search components').fill('R831');

    await expect.element(screen.getByText('Spare')).toBeVisible();
    await expect.element(screen.getByText('Unavailable')).not.toBeInTheDocument();
  });

  it('groups the catalog by instrument instead of repeating an Instrument column', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-10-15');

    // Each group leads with its one-line answer: piece count and how many are
    // riding tonight. The old Instrument column printed "GMOS" two dozen times.
    await expect.element(screen.getByText('pieces', { exact: false }).first()).toBeVisible();
    await expect.element(screen.getByText('on telescope', { exact: false }).first()).toBeVisible();
    await expect.element(screen.getByRole('columnheader', { name: 'Instrument' })).not.toBeInTheDocument();
  });

  it('opens a row into the piece history, phrased in evening dates', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-12-15');
    await screen.getByLabelText('Search components').fill('R400');

    // PrimeReact labels the toggler with the row's dataKey.
    await screen.getByRole('button', { name: /expand k-gs-R400_G5325/i }).click();

    const history = screen.getByTestId('component-history');
    await expect.element(history).toBeVisible();
    await expect.element(history.getByText('Failed; removed for repair')).toBeVisible();
  });

  it('filters by instrument', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-10-15');
    // Both F2 and GSAOI carry a K-short; the instrument filter clears them all.
    await expect.element(screen.getByText('K-short').first()).toBeVisible();

    await selectDropdownOption(screen, 'Instrument', 'GMOS');

    await expect.element(screen.getByText('K-short')).not.toBeInTheDocument();
    await expect.element(screen.getByText('B1200').first()).toBeVisible();
  });

  it('organizes the instrument filter: sorted options carrying their counts', async () => {
    const screen = await open('/components?site=GS&semester=2025B&night=2025-10-15');
    await expect.element(screen.getByText('B1200').first()).toBeVisible();

    await openDropdown(screen, 'Instrument');

    // Alphabetical, and every option says what choosing it buys.
    await expect.element(page.getByRole('option', { name: /^GHOST \(\d+\)$/ })).toBeVisible();
    const options = [...document.querySelectorAll('[role="option"]')].map((option) => option.textContent ?? '');
    expect(options).toEqual([...options].sort((a, b) => a.localeCompare(b)));
  });
});
