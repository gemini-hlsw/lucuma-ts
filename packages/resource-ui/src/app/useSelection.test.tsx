/**
 * `useSelection`, the shared site/semester/night/clock reading of the URL.
 *
 * Every one of these is a rule the app depends on somewhere visible: a bare
 * URL opens on the night in progress rather than a fixed date; a mistyped
 * clock degrades to the site's own rather than blanking; a semester jump drops
 * the calendar month it invalidates, and does it in one update so the URL is
 * never half-changed; and the default clock is deleted from the URL, not
 * written.
 */
import { describe, expect, it } from 'vitest';

import { observingNightOf } from '@/domain/siteTime';
import { Probe, PROBE_URL_TESTID } from '@/test/probe';
import { renderApp } from '@/test/renderApp';

import { useSelection } from './useSelection';

const openSelection = async (route: string) =>
  renderApp({
    route,
    element: (
      <Probe
        use={useSelection}
        readout={(selection) => ({
          site: selection.site,
          night: selection.observingNight,
          clock: selection.timeDisplay,
          semester: selection.semester ?? 'none',
          tonight: selection.tonight,
        })}
        actions={(selection) => [
          { label: 'to GS', run: () => selection.setSite('GS') },
          { label: 'set semester 2025A', run: () => selection.setSemester('2025A') },
          { label: 'jump to 2025A', run: () => selection.setSemesterSelection('2025A', '2025-03-01') },
          { label: 'jump keeping the night', run: () => selection.setSemesterSelection('2025A', null) },
          { label: 'to UTC', run: () => selection.setTimeDisplay('utc') },
          { label: 'to site clock', run: () => selection.setTimeDisplay('site') },
          { label: 'tonight', run: selection.clearObservingNight },
        ]}
      />
    ),
  });

describe(useSelection.name, () => {
  it('reads the whole selection out of the query string', async () => {
    const screen = await openSelection('/night?site=GS&semester=2025B&night=2025-11-14&clock=utc');

    await expect.element(screen.getByTestId('probe-site')).toHaveTextContent('GS');
    await expect.element(screen.getByTestId('probe-semester')).toHaveTextContent('2025B');
    await expect.element(screen.getByTestId('probe-night')).toHaveTextContent('2025-11-14');
    await expect.element(screen.getByTestId('probe-clock')).toHaveTextContent('utc');
  });

  it('opens on the night in progress when the URL names none, never a fixed date', async () => {
    const screen = await openSelection('/night?site=GS');

    // Derived with the function the page uses, so this cannot decay the way a
    // hardcoded date would.
    const inProgress = observingNightOf('GS', Date.now());
    await expect.element(screen.getByTestId('probe-night')).toHaveTextContent(inProgress);
  });

  it('reads an unknown site as Gemini North rather than rendering nothing', async () => {
    const screen = await openSelection('/night?site=elsewhere');

    await expect.element(screen.getByTestId('probe-site')).toHaveTextContent('GN');
  });

  it('degrades a mistyped clock to the site clock, which is what the site works in', async () => {
    const screen = await openSelection('/night?site=GS&clock=martian');

    await expect.element(screen.getByTestId('probe-clock')).toHaveTextContent('site');
  });

  it('leaves the semester null when the URL names none - resolving it is useSemester s job', async () => {
    const screen = await openSelection('/night?site=GS');

    await expect.element(screen.getByTestId('probe-semester')).toHaveTextContent('none');
  });

  it('keeps the calendar month across a site change, since both sites cover the same months', async () => {
    const screen = await openSelection('/semester?site=GN&month=2026-11');

    await screen.getByRole('button', { name: 'to GS' }).click();

    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).toHaveTextContent('site=GS');
    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).toHaveTextContent('month=2026-11');
  });

  it('drops the calendar month on a semester change - it named a page of the old one', async () => {
    const screen = await openSelection('/semester?site=GS&semester=2025B&month=2025-11');

    await screen.getByRole('button', { name: 'set semester 2025A' }).click();

    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).toHaveTextContent('semester=2025A');
    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).not.toHaveTextContent('month');
  });

  it('moves the night with the semester in one update, so the control is never a silent no-op', async () => {
    const screen = await openSelection('/night?site=GS&semester=2025B&night=2025-11-14&month=2025-11');

    await screen.getByRole('button', { name: 'jump to 2025A' }).click();

    // One URL: the semester, the night inside it, and no month naming a page
    // of the semester just left. Two updates would let a render see the night
    // outside the semester.
    await expect.element(screen.getByTestId('probe-semester')).toHaveTextContent('2025A');
    await expect.element(screen.getByTestId('probe-night')).toHaveTextContent('2025-03-01');
    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).not.toHaveTextContent('month');
  });

  it('leaves the night alone when the jump does not name one - the caller decides', async () => {
    const screen = await openSelection('/night?site=GS&semester=2025B&night=2025-11-14');

    await screen.getByRole('button', { name: 'jump keeping the night' }).click();

    await expect.element(screen.getByTestId('probe-semester')).toHaveTextContent('2025A');
    await expect.element(screen.getByTestId('probe-night')).toHaveTextContent('2025-11-14');
  });

  it('drops the night from the URL for Tonight, rather than writing today into it', async () => {
    const screen = await openSelection('/night?site=GS&night=2025-11-14');

    await screen.getByRole('button', { name: 'tonight' }).click();

    // The URL says "the night in progress", so it keeps meaning that tomorrow.
    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).not.toHaveTextContent('night=');
    await expect.element(screen.getByTestId('probe-night')).toHaveTextContent(observingNightOf('GS', Date.now()));
  });

  it('writes the UT clock but deletes the default, like every other URL default here', async () => {
    const screen = await openSelection('/night?site=GS');

    await screen.getByRole('button', { name: 'to UTC' }).click();
    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).toHaveTextContent('clock=utc');

    await screen.getByRole('button', { name: 'to site clock' }).click();
    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).not.toHaveTextContent('clock');
  });
});
