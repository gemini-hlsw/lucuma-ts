import { ApolloLink } from '@apollo/client';
import { isNotNullish } from '@gemini-hlsw/lucuma-common-ui';
import { describe, expect, it } from 'vitest';

import Layout from '@/components/layout/Layout';
import { buildSemesterTimeline } from '@/domain/semesterTimeline';
import { buildMonthLines } from '@/features/semester/semesterMonthOptions';
import { selectDropdownOption } from '@/test/helpers';
import { createMockApollo } from '@/test/mockClient';
import { renderApp } from '@/test/renderApp';

import NightPage from './NightPage';
import SemesterPage from './SemesterPage';

const openSemester = async (route: string) => renderApp({ element: <SemesterPage />, route });

describe('SemesterPage - the chart', () => {
  it('opens on the chart, one block per month', async () => {
    const screen = await openSemester('/semester?site=GS&semester=2025B');

    await expect.element(screen.getByText('Gemini South Semester 2025B', { exact: false })).toBeVisible();
    await expect.element(screen.getByTestId('semester-timeline')).toBeVisible();
    // August 2025 through January 2026, grouped by the evening date's month.
    await expect.element(screen.getByRole('region', { name: 'August 2025' })).toBeVisible();
    await expect.element(screen.getByRole('region', { name: 'January 2026' })).toBeVisible();
  });

  it('names each instrument on its run rather than in the colour', async () => {
    const screen = await openSemester('/semester?site=GS&semester=2025B');

    // Identity is text, which survives every kind of colour vision.
    await expect.element(screen.getByText('GHOST').first()).toBeVisible();
    await expect.element(screen.getByText('GCAL').first()).toBeVisible();
  });

  it('keys the colours to instruments, listing only the ones it drew', async () => {
    const north = await openSemester('/semester?site=GN&semester=2026B');
    const legend = north.getByLabelText('Legend');

    await expect.element(legend.getByText('GMOS')).toBeVisible();
    await expect.element(legend.getByText('Altair')).toBeVisible();
    // GHOST is a Gemini South instrument; the late-October weather closure gets the one closure key.
    await expect.element(legend.getByText('GHOST')).not.toBeInTheDocument();
    await expect.element(legend.getByText('Closed')).toBeVisible();
  });

  it('gives each instrument its own colour', async () => {
    const screen = await openSemester('/semester?site=GS&semester=2025B');
    await expect.element(screen.getByRole('region', { name: 'September 2025' })).toBeVisible();

    // The token, not the computed colour: renderApp loads no stylesheet, so var(--instrument-x) is inert.
    const marks = screen
      .getByRole('region', { name: 'September 2025' })
      .element()
      // path, not the wrapping <g>: Highcharts puts the class on both and only the path carries the fill.
      .querySelectorAll('path.highcharts-point:not(.schedule-ghost)');
    const fills = new Set([...marks].map((mark) => mark.getAttribute('fill')));

    // The state rows head the chart in the routine neutral, never an instrument hue.
    expect(fills).toEqual(
      new Set([
        'var(--instrument-ghost)',
        'var(--instrument-gcal)',
        'var(--instrument-gmos)',
        'var(--instrument-canopus)',
        'var(--instrument-f2)',
        'var(--state-routine)',
      ]),
    );
  });

  it('keys the weekend shading it draws under every month', async () => {
    const screen = await openSemester('/semester?site=GS&semester=2025B');

    await expect
      .element(screen.getByLabelText('Legend').getByRole('group', { name: 'Calendar' }).getByText('Weekend'))
      .toBeVisible();
  });

  it('draws the workbook shutdown as a band with its key', async () => {
    // GS opens 2024B shut: evenings 1-15 August are Closed/Shutdown rows.
    const screen = await openSemester('/semester?site=GS&semester=2024B');

    await expect.element(screen.getByLabelText('Legend').getByText('Closed')).toBeVisible();
  });

  it('switches to Gemini North, organised by the same five ports', async () => {
    const screen = await openSemester('/semester?site=GN&semester=2026B');

    await expect.element(screen.getByText('Gemini North Semester 2026B', { exact: false })).toBeVisible();
    await expect.element(screen.getByRole('region', { name: 'August 2026' })).toBeVisible();
  });

  it('survives the masthead clock toggle without redrawing a single bar', async () => {
    // The chart speaks dates, so the toggle's re-render must leave every bar exactly where it was.
    const screen = await renderApp({
      element: <Layout />,
      route: '/semester?site=GN&semester=2026B',
      path: '/',
      childRoutes: [{ path: 'semester', element: <SemesterPage /> }],
    });
    await expect.element(screen.getByRole('region', { name: 'August 2026' })).toBeVisible();
    const shapes = () =>
      [...document.querySelectorAll('[data-testid^="semester-month-"] .highcharts-point')]
        .map((point) => `${point.getAttribute('d') ?? ''}#${point.getAttribute('fill') ?? ''}`)
        .join('|');
    await expect.poll(() => shapes().length).toBeGreaterThan(0);
    const before = shapes();

    await screen.getByRole('button', { name: 'Coordinated Universal Time' }).click();

    await expect
      .element(screen.getByRole('button', { name: 'Coordinated Universal Time' }))
      .toHaveAttribute('aria-pressed', 'true');
    await expect.poll(shapes).toBe(before);
  });

  it('opens the night view when a bar is clicked', async () => {
    const screen = await renderApp({
      element: <SemesterPage />,
      route: '/semester?site=GS&semester=2025B',
      extraRoutes: [{ path: '/night', element: <NightPage /> }],
    });
    await expect.element(screen.getByRole('region', { name: 'August 2025' })).toBeVisible();
    const august = '[data-testid="semester-month-August 2025"]';
    await expect.poll(() => document.querySelector(`${august} .highcharts-point`)).not.toBeNull();

    // Which night a bar's centre lands on is what nightAt pins; the assertion is the jump itself.
    const bar = document.querySelector(`${august} .highcharts-point`);
    const { page } = await import('vitest/browser');
    await page.elementLocator(bar!).click();

    await expect.element(screen.getByTestId('night-timeline')).toBeVisible();
  });
});

describe('SemesterPage - the calendar', () => {
  const showCalendar = async (screen: Awaited<ReturnType<typeof openSemester>>) => {
    await screen.getByRole('button', { name: 'Calendar' }).click();
    await expect.element(screen.getByTestId('semester-calendar')).toBeVisible();
  };

  it('opens on the month the semester starts in, not on today', async () => {
    const screen = await openSemester('/semester?site=GS&semester=2025B');
    await showCalendar(screen);

    // The night squares are the assertion: the printed title also exists as a hidden native <option>.
    await expect.element(screen.getByRole('button', { name: 'Open night beginning 2025-08-14' })).toBeVisible();
  });

  it('is a sendable link: view and month come from the URL', async () => {
    const screen = await openSemester('/semester?site=GS&semester=2025B&view=calendar&month=2025-11');

    await expect.element(screen.getByTestId('semester-calendar')).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Open night beginning 2025-11-14' })).toBeVisible();
  });

  it('drops the month when leaving the calendar - a chart link carries just the semester', async () => {
    const screen = await openSemester('/semester?site=GS&semester=2025B&view=calendar&month=2025-11');
    await expect.element(screen.getByRole('button', { name: 'Open night beginning 2025-11-14' })).toBeVisible();

    await screen.getByRole('button', { name: 'Chart' }).click();
    await expect.element(screen.getByTestId('semester-timeline')).toBeVisible();
    await screen.getByRole('button', { name: 'Calendar' }).click();

    // The chart link had no month to carry, so returning starts from the semester's first month.
    await expect.element(screen.getByRole('button', { name: 'Open night beginning 2025-08-14' })).toBeVisible();
  });

  it('drops the month when the semester changes - it named a page of the old one', async () => {
    // The semester control lives in the masthead, so the test mounts the shell around the page.
    const screen = await renderApp({
      element: <Layout />,
      route: '/semester?site=GS&semester=2025B&view=calendar&month=2025-11',
      path: '/',
      childRoutes: [{ path: 'semester', element: <SemesterPage /> }],
    });
    await expect.element(screen.getByRole('button', { name: 'Open night beginning 2025-11-14' })).toBeVisible();

    await selectDropdownOption(screen, 'Semester', '2025A');
    await expect.element(screen.getByRole('button', { name: 'Open night beginning 2025-02-14' })).toBeVisible();

    // November belonged to the link that named it, not to the semester control.
    await selectDropdownOption(screen, 'Semester', '2025B');
    await expect.element(screen.getByRole('button', { name: 'Open night beginning 2025-08-14' })).toBeVisible();
  });

  it('reads an unknown month parameter as the first month, never an empty grid', async () => {
    // A stale month from another semester must not strand the reader outside it (I4).
    const screen = await openSemester('/semester?site=GS&semester=2025B&view=calendar&month=1999-01');

    await expect.element(screen.getByRole('button', { name: 'Open night beginning 2025-08-14' })).toBeVisible();
  });

  it('jumps straight to any month from the picker', async () => {
    const screen = await openSemester('/semester?site=GS&semester=2025B');
    await showCalendar(screen);

    await selectDropdownOption(screen, 'Month', 'January 2026');

    // A January-only night proves the grid moved with the picker.
    await expect.element(screen.getByRole('button', { name: 'Open night beginning 2026-01-15' })).toBeVisible();
  });

  it('shows the moon and the length of the night, which no other view carries', async () => {
    const screen = await openSemester('/semester?site=GS&semester=2025B');
    await showCalendar(screen);

    // Per-night facts are why the calendar exists beside two run views; the moon is computed.
    await expect.element(screen.getByTestId('moon-disc').first()).toBeVisible();
    await expect.element(screen.getByText(/^\d+\.\d h$/).first()).toBeVisible();
  });

  it('draws the news as single-evening chips, never the steady run bars', async () => {
    // Altair and GMOS-N run the whole semester and are furniture; drawing them here would bury the news.
    const screen = await openSemester('/semester?site=GN&semester=2026B&view=calendar');
    const calendar = screen.getByTestId('semester-calendar');

    await expect.element(calendar.getByText('IGRINS-2 → MAROON-X').first()).toBeVisible();
    await expect.element(calendar.getByText('Altair')).not.toBeInTheDocument();
    await expect.element(calendar.getByText('GMOS-N')).not.toBeInTheDocument();
  });

  it('chips a usability change by the new usage - the restriction is the news', async () => {
    // GNIRS is recorded Not Available 6-17 August 2026: one chip when it fails, one when it returns.
    const screen = await openSemester('/semester?site=GN&semester=2026B&view=calendar');
    const calendar = screen.getByTestId('semester-calendar');

    await expect.element(calendar.getByText('GNIRS: Not available').first()).toBeVisible();
    await expect.element(calendar.getByText('GNIRS: Science').first()).toBeVisible();
  });

  it('chips the telescope closing and reopening, with the closed squares washed', async () => {
    // The closure sits strictly inside the semester, so both edges are news; the span itself is wash.
    const screen = await openSemester('/semester?site=GN&semester=2026B&view=calendar&month=2026-10');
    const calendar = screen.getByTestId('semester-calendar');

    await expect.element(calendar.getByText('Closed').first()).toBeVisible();
    await expect.element(calendar.getByText('Open').first()).toBeVisible();
    expect(document.querySelectorAll('.rbc-day-bg.night-closed').length).toBeGreaterThan(0);
  });

  it('will not page out of the semester, where an empty grid would read as closed', async () => {
    const screen = await openSemester('/semester?site=GS&semester=2025B');
    await showCalendar(screen);

    // August is the first month the semester covers, so there is nothing before it.
    await expect.element(screen.getByRole('button', { name: 'Previous month' })).toBeDisabled();
  });

  it('carries the closure reason on the closed square itself, not just its header', async () => {
    const screen = await openSemester('/semester?site=GS&semester=2024B&view=calendar');
    await expect.element(screen.getByRole('button', { name: 'Open night beginning 2024-08-02' })).toBeVisible();

    // A closed square is mostly wash, so hovering anywhere on it must still surface the reason.
    const closed = [...document.querySelectorAll('.rbc-day-bg.night-closed')];
    expect(closed.length).toBeGreaterThan(0);
    for (const square of closed) {
      expect(square.getAttribute('title')).toContain('Shutdown');
    }
  });

  it('opens the night view when a night is clicked', async () => {
    const screen = await renderApp({
      element: <SemesterPage />,
      route: '/semester?site=GS&semester=2025B',
      extraRoutes: [{ path: '/night', element: <NightPage /> }],
    });
    await showCalendar(screen);

    // The whole square is the link; the date header is its accessible name.
    await screen.getByRole('button', { name: 'Open night beginning 2025-08-14' }).click();

    await expect.element(screen.getByText('Night of 2025-08-15')).toBeVisible();
  });

  it('replaces the chart rather than joining it', async () => {
    const screen = await openSemester('/semester?site=GS&semester=2025B');
    await showCalendar(screen);

    await expect.element(screen.getByTestId('semester-timeline')).not.toBeInTheDocument();
  });

  it('keeps the block table, which is the reading for every view', async () => {
    const screen = await openSemester('/semester?site=GS&semester=2025B');
    await showCalendar(screen);

    await expect.element(screen.getByTestId('semester-block-table')).toBeInTheDocument();
  });
});

/** Not a view, so it must be present whichever picture is drawn. */
describe('SemesterPage - the block table', () => {
  it('states a run once, with its extent, rather than once per night', async () => {
    const screen = await openSemester('/semester?site=GS&semester=2025B');

    const table = screen.getByTestId('semester-block-table');
    await expect.element(table).toBeInTheDocument();
    // GHOST is one block from August to January, so it is one row: the point of a block table.
    await expect.element(table.getByRole('row', { name: /Port 1 GHOST 1 Aug 2025/ })).toBeInTheDocument();
  });

  it('files a telescope-wide closure under no port, with the whole phrase', async () => {
    const screen = await openSemester('/semester?site=GS&semester=2024B');

    await expect
      .element(screen.getByTestId('semester-block-table').getByRole('row', { name: /Whole telescope/ }))
      .toBeInTheDocument();
  });
});

/** Chart and calendar each derive the week boundary themselves, so a one-night drift is possible. */
describe('SemesterPage - the week boundary both views draw', () => {
  const EVENING_PREFIX = 'Open night beginning ';

  /** The evening date a calendar square opens, or null for one outside the semester. */
  const eveningOf = (cell: Element): string | null =>
    cell.querySelector(`[aria-label^="${EVENING_PREFIX}"]`)?.getAttribute('aria-label')?.slice(EVENING_PREFIX.length) ??
    null;

  it('emphasises the nights the calendar puts in its first column', async () => {
    const screen = await openSemester('/semester?site=GS&semester=2025B&view=calendar&month=2025-11');
    await expect.element(screen.getByRole('button', { name: 'Open night beginning 2025-11-14' })).toBeVisible();

    // Only the evening dates matter here, so it needs no records.
    const november = buildSemesterTimeline({
      site: 'GS',
      firstNight: '2025-11-02',
      lastNight: '2025-12-01',
      mountings: [],
      closures: [],
    }).months[0]!;
    const monthEvenings = new Set(november.nights.map((night) => night.eveningDate));

    const lines = buildMonthLines(november);
    const chartWeekStarts = new Set(
      november.nights
        .filter((night) =>
          lines.some((line) => line.value === night.interval.start && line.color === 'var(--schedule-week-line)'),
        )
        .map((night) => night.eveningDate),
    );

    // The grid reaches into neighbouring months, hence the restriction to the evenings this chart drew.
    const cells = [...document.querySelectorAll('.rbc-date-cell')];
    expect(cells.length % 7).toBe(0);
    const calendarWeekStarts = new Set(
      cells
        .filter((_, index) => index % 7 === 0)
        .map(eveningOf)
        .filter(isNotNullish)
        .filter((evening) => monthEvenings.has(evening)),
    );

    // Non-empty first: two empty sets agree about nothing.
    expect(calendarWeekStarts.size).toBeGreaterThan(3);
    expect(chartWeekStarts).toEqual(calendarWeekStarts);
  });
});

describe('SemesterPage - the window it asks for', () => {
  it('asks over the observing nights, not the calendar days they are labelled by', async () => {
    const sent: { name: string; variables: Record<string, unknown> }[] = [];
    const screen = await renderApp({
      element: <SemesterPage />,
      route: '/semester?site=GS&semester=2025B',
      mock: createMockApollo(
        new ApolloLink((operation, forward) => {
          sent.push({ name: operation.operationName ?? '', variables: operation.variables });
          return forward(operation);
        }),
      ),
    });
    await expect.element(screen.getByRole('region', { name: 'August 2025' })).toBeVisible();

    // The two ends sit in different offsets, so a calendar-day window is wrong at both and no offset fixes it.
    const semester = sent.find((operation) => operation.name === 'SemesterSchedule');
    expect(semester?.variables.interval).toEqual({
      start: '2025-08-01T18:00:00.000Z',
      end: '2026-02-01T17:00:00.000Z',
    });
  });
});

describe('SemesterPage - every published semester', () => {
  it('offers every semester Resource holds', async () => {
    const screen = await openSemester('/semester?site=GS&semester=2025A');

    await expect.element(screen.getByText('Gemini South Semester 2025A', { exact: false })).toBeVisible();
  });
});
