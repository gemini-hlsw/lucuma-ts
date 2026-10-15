import type { InstrumentAvailabilityBlockItemFragment } from '@gql/gen/graphql';
import { describe, expect, it } from 'vitest';

import { instrumentAvailabilityBlock } from '@/test/fixtures/blocks';
import { type PublishedSemesterRow, publishedSemesters, recentSpan, semesterSchedule } from '@/test/fixtures/semester';
import { nightsFromTonight, semesterFromTonight } from '@/test/fixtures/tonight';
import { openDropdown, selectDropdownOption } from '@/test/helpers';
import { renderApp } from '@/test/renderApp';

import InstrumentsPage from './InstrumentsPage';

const GN_CURRENT = semesterFromTonight('GN', -90, 90);
const GS_EARLIER = semesterFromTonight('GS', -270, -91);
const GS_CURRENT = semesterFromTonight('GS', -90, 90);

const GN_NIGHT = '/instruments?site=GN';
const GN_WHOLE = nightsFromTonight('GN', -60, 60);
const GS_WHOLE = nightsFromTonight('GS', -60, 60);

const GNIRS = instrumentAvailabilityBlock({ instrument: 'GNIRS', port: 3, interval: GN_WHOLE });
const MAROON_X = instrumentAvailabilityBlock({
  instrument: 'MAROON_X',
  publishedName: 'Maroon-X',
  port: 5,
  interval: GN_WHOLE,
});
const ALOPEKE = instrumentAvailabilityBlock({ instrument: 'ALOPEKE', place: 'UNKNOWN', interval: GN_WHOLE });
const NIRI = instrumentAvailabilityBlock({
  instrument: 'NIRI',
  place: 'LAB',
  usage: 'UNAVAILABLE',
  interval: GN_WHOLE,
});
const ACQ_CAM = instrumentAvailabilityBlock({
  instrument: 'ACQ_CAM',
  place: 'LAB',
  usage: 'UNAVAILABLE',
  interval: GN_WHOLE,
});
/** Off Port 1 since before tonight, so tonight holds no record for it. */
const IGRINS2_GONE = instrumentAvailabilityBlock({
  instrument: 'IGRINS2',
  port: 1,
  interval: nightsFromTonight('GN', -60, -20),
});
/** Not available for twelve nights, then back on Port 3. */
const GNIRS_SPLIT = [
  instrumentAvailabilityBlock({
    instrument: 'GNIRS',
    port: 3,
    usage: 'UNAVAILABLE',
    interval: nightsFromTonight('GN', -50, -39),
  }),
  instrumentAvailabilityBlock({ instrument: 'GNIRS', port: 3, interval: nightsFromTonight('GN', -38, 60) }),
];

/** The site's semesters in date order, and the blocks the schedule holds over the recent window. */
const openInstruments = (
  route: string,
  semesters: readonly [PublishedSemesterRow, ...PublishedSemesterRow[]],
  instrumentAvailability: InstrumentAvailabilityBlockItemFragment[],
) =>
  renderApp({
    element: <InstrumentsPage />,
    route,
    mocks: [
      publishedSemesters(...semesters),
      semesterSchedule(recentSpan(semesters[0].site), { instrumentAvailability }),
    ],
  });

describe(InstrumentsPage, () => {
  it('lists the site catalog with where each instrument is tonight', async () => {
    const screen = await openInstruments(GN_NIGHT, [GN_CURRENT], [GNIRS]);

    await expect.element(screen.getByText('GNIRS')).toBeVisible();
    await expect.element(screen.getByText('Port 3')).toBeVisible();
  });

  it('answers for tonight whatever night the URL names', async () => {
    const screen = await openInstruments(`${GN_NIGHT}&night=2024-01-01`, [GN_CURRENT], [GNIRS]);

    await expect.element(screen.getByText('Port 3')).toBeVisible();
    await expect.element(screen.getByText('Not recorded')).not.toBeInTheDocument();
  });

  it('gives the record its own Note column rather than tucking it under the status', async () => {
    // Under the badge a note starts at a different x on every row, under no heading of its own.
    const screen = await openInstruments(
      '/instruments?site=GS',
      [GS_CURRENT],
      [
        instrumentAvailabilityBlock({
          instrument: 'GPI',
          place: 'BASE',
          usage: 'UNAVAILABLE',
          note: 'Stored at the base facility',
          interval: GS_WHOLE,
        }),
      ],
    );

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
    const screen = await openInstruments(GN_NIGHT, [GN_CURRENT], [ALOPEKE]);

    await expect.element(screen.getByText("'Alopeke").first()).toBeVisible();
    await expect.element(screen.getByText('Not on a port').first()).toBeVisible();
  });

  it('says nothing is recorded rather than reading an absence as unavailable', async () => {
    const screen = await openInstruments(GN_NIGHT, [GN_CURRENT], [IGRINS2_GONE]);

    await expect.element(screen.getByText('IGRINS2')).toBeVisible();
    await expect.element(screen.getByText('Not recorded')).toBeVisible();
  });

  it('opens a row into the instrument runs, showing a usability window', async () => {
    const screen = await openInstruments(GN_NIGHT, [GN_CURRENT], GNIRS_SPLIT);

    await screen.getByRole('button', { name: /expand GNIRS/i }).click();

    const runs = screen.getByTestId('instrument-runs');
    await expect.element(runs).toBeVisible();
    await expect.element(runs.getByText('Not available')).toBeVisible();
  });

  it('heads the runs with the same columns whether or not the records fill them', async () => {
    const screen = await openInstruments(GN_NIGHT, [GN_CURRENT], GNIRS_SPLIT);
    await screen.getByRole('button', { name: /expand GNIRS/i }).click();

    // Two expansions on one page must not disagree about what a column means.
    const runs = screen.getByTestId('instrument-runs');
    for (const column of ['Dates', 'Nights', 'Where', 'Status', 'Note']) {
      await expect.element(runs.getByRole('columnheader', { name: column })).toBeVisible();
    }
  });

  it('counts the nights each run lasted, which is what a run list is read for', async () => {
    const screen = await openInstruments(GN_NIGHT, [GN_CURRENT], GNIRS_SPLIT);
    await screen.getByRole('button', { name: /expand GNIRS/i }).click();

    const runs = screen.getByTestId('instrument-runs');
    await expect.element(runs.getByRole('row', { name: /Not available/ })).toMatchTextContent('12');
  });

  it('search narrows across the tag and the published name', async () => {
    const screen = await openInstruments(GN_NIGHT, [GN_CURRENT], [GNIRS, MAROON_X]);
    await expect.element(screen.getByText('GNIRS')).toBeVisible();

    await screen.getByLabelText('Search').fill('maroon');

    await expect.element(screen.getByText('Maroon-X').first()).toBeVisible();
    await expect.element(screen.getByText('GNIRS')).not.toBeInTheDocument();
  });

  it('is a sendable link: the search comes from the URL', async () => {
    const screen = await openInstruments(`${GN_NIGHT}&q=gnirs`, [GN_CURRENT], [GNIRS, MAROON_X]);

    await expect.element(screen.getByText('GNIRS')).toBeVisible();
    await expect.element(screen.getByText('Maroon-X').first()).not.toBeInTheDocument();
  });

  it('holds every instrument the site has recorded, not just this semester', async () => {
    // Zorro sits out this semester but is a GS instrument: a semester-scoped browser would say nothing.
    const screen = await openInstruments(
      '/instruments?site=GS',
      [GS_EARLIER, GS_CURRENT],
      [
        instrumentAvailabilityBlock({
          instrument: 'CAL_ZORRO',
          publishedName: 'Zorro',
          port: 2,
          interval: nightsFromTonight('GS', -250, -220),
        }),
      ],
    );

    await expect.element(screen.getByText('Zorro').first()).toBeVisible();
    await expect.element(screen.getByText('Not recorded')).toBeVisible();
  });

  it('filters by location, counting what each choice buys', async () => {
    const screen = await openInstruments(GN_NIGHT, [GN_CURRENT], [GNIRS, ALOPEKE]);
    await expect.element(screen.getByText('GNIRS')).toBeVisible();

    await selectDropdownOption(screen, 'Location', 'Not on a port (1)');

    await expect.element(screen.getByText("'Alopeke").first()).toBeVisible();
    await expect.element(screen.getByText('GNIRS')).not.toBeInTheDocument();
  });

  it('orders the location choices from the telescope outwards', async () => {
    const screen = await openInstruments(
      GN_NIGHT,
      [GN_CURRENT],
      [
        ALOPEKE,
        IGRINS2_GONE,
        NIRI,
        ACQ_CAM,
        GNIRS,
        instrumentAvailabilityBlock({ instrument: 'ALTAIR', port: 3, interval: GN_WHOLE }),
        instrumentAvailabilityBlock({ instrument: 'GMOS', port: 1, interval: GN_WHOLE }),
      ],
    );
    await expect.element(screen.getByText('GNIRS')).toBeVisible();

    await openDropdown(screen, 'Location');

    const options = [...document.querySelectorAll('[role="option"]')].map((option) => option.textContent ?? '');
    expect(options).toEqual(['Port 1 (1)', 'Port 3 (2)', 'Summit lab (2)', 'Not on a port (1)', 'Not recorded (1)']);
  });

  it('holds the instruments GPP knows that the schedule never mounts', async () => {
    // The stored layer carries a storage place, never a port, which keeps it off the charts.
    const screen = await openInstruments(GN_NIGHT, [GN_CURRENT], [NIRI, ACQ_CAM]);

    await expect.element(screen.getByText('NIRI')).toBeVisible();
    await expect.element(screen.getByText('AcqCam')).toBeVisible();
    await expect.element(screen.getByText('Summit lab').first()).toBeVisible();
  });

  it('filters to a storage place, which is what a stored instrument has instead of a port', async () => {
    const screen = await openInstruments(
      '/instruments?site=GS',
      [GS_CURRENT],
      [
        instrumentAvailabilityBlock({ instrument: 'GPI', place: 'BASE', usage: 'UNAVAILABLE', interval: GS_WHOLE }),
        instrumentAvailabilityBlock({ instrument: 'GHOST', port: 1, interval: GS_WHOLE }),
      ],
    );
    await expect.element(screen.getByText('GHOST')).toBeVisible();

    await selectDropdownOption(screen, 'Location', 'Base facility (1)');

    await expect.element(screen.getByText('GPI')).toBeVisible();
    await expect.element(screen.getByText('GHOST')).not.toBeInTheDocument();
  });

  it('is a sendable link: the location filter comes from the URL', async () => {
    const screen = await openInstruments(`${GN_NIGHT}&location=Port+3`, [GN_CURRENT], [GNIRS, MAROON_X]);

    await expect.element(screen.getByText('GNIRS')).toBeVisible();
    await expect.element(screen.getByText('Maroon-X').first()).not.toBeInTheDocument();
  });

  it('answers per site - Gemini South holds its own instruments', async () => {
    const screen = await renderApp({
      element: <InstrumentsPage />,
      route: '/instruments?site=GS',
      mocks: [
        publishedSemesters(GS_CURRENT, GN_CURRENT),
        semesterSchedule(recentSpan('GN'), { instrumentAvailability: [GNIRS] }),
        semesterSchedule(recentSpan('GS'), {
          instrumentAvailability: [instrumentAvailabilityBlock({ instrument: 'GHOST', port: 1, interval: GS_WHOLE })],
        }),
      ],
    });

    await expect.element(screen.getByText('GHOST')).toBeVisible();
    await expect.element(screen.getByText('GNIRS')).not.toBeInTheDocument();
  });

  it('does not wear a distant demo semester’s flag for a night the gap between semesters leaves uncovered', async () => {
    // Tonight is nearer the demo semester, so a "nearest semester" fallback would borrow its flag.
    const screen = await openInstruments(
      '/instruments?site=GS',
      [semesterFromTonight('GS', -200, -30), semesterFromTonight('GS', 10, 190, { demo: true })],
      [],
    );

    await expect.element(screen.getByTestId('instrument-table')).toBeVisible();
    await expect.element(screen.getByTestId('synthetic-data-tag')).not.toBeInTheDocument();
  });

  it('flags a night the demo semester actually holds', async () => {
    const screen = await openInstruments(
      '/instruments?site=GS',
      [semesterFromTonight('GS', -200, -30), semesterFromTonight('GS', -10, 170, { demo: true })],
      [],
    );

    await expect.element(screen.getByTestId('instrument-table')).toBeVisible();
    await expect.element(screen.getByTestId('synthetic-data-tag')).toBeVisible();
  });
});
