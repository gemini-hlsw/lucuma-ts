import { describe, expect, it } from 'vitest';

import Layout from '@/components/layout/Layout';
import { selectDropdownOption } from '@/test/helpers';
import { renderApp } from '@/test/renderApp';

import NightPage from './NightPage';
import SemesterPage from './SemesterPage';

const openSemester = async (route: string) => renderApp({ element: <SemesterPage />, route });

/** The grid is a click away; the chart is what the page opens on. */
const showGrid = async (screen: Awaited<ReturnType<typeof openSemester>>) => {
  await screen.getByRole('button', { name: 'Grid' }).click();
  await expect.element(screen.getByTestId('semester-heatmap')).toBeVisible();
};

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
    // GHOST is a Gemini South instrument; its key does not belong here. The
    // late-October weather closure does, and gets the one closure key.
    await expect.element(legend.getByText('GHOST')).not.toBeInTheDocument();
    await expect.element(legend.getByText('Closed')).toBeVisible();
  });

  it('gives each instrument its own colour', async () => {
    const screen = await openSemester('/semester?site=GS&semester=2025B');
    await expect.element(screen.getByRole('region', { name: 'September 2025' })).toBeVisible();

    // The token, not the computed colour: renderApp does not load the app
    // stylesheet, so `var(--instrument-…)` never resolves in a test. What the
    // page owes us here is that each instrument reached the DOM with its own
    // token; that the tokens are far enough apart is the validator's job.
    const marks = screen
      .getByRole('region', { name: 'September 2025' })
      .element()
      // path, not the wrapping <g>: Highcharts puts the class on both and only
      // the path carries the fill.
      .querySelectorAll('path.highcharts-point:not(.schedule-ghost)');
    const fills = new Set([...marks].map((mark) => mark.getAttribute('fill')));

    // The workbook mounts all five GS ports through 2025B, and the state rows
    // head the chart in the routine neutral - the workbook's Queue / No ToOs -
    // never an instrument hue.
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

  it('opens the night view when a bar is clicked', async () => {
    const screen = await renderApp({
      element: <SemesterPage />,
      route: '/semester?site=GS&semester=2025B',
      extraRoutes: [{ path: '/night', element: <NightPage /> }],
    });
    await expect.element(screen.getByRole('region', { name: 'August 2025' })).toBeVisible();
    const august = '[data-testid="semester-month-August 2025"]';
    await expect.poll(() => document.querySelector(`${august} .highcharts-point`)).not.toBeNull();

    // Clicking a bar opens the night under the cursor - which night that is
    // depends on where the bar's centre lands, so the assertion is the jump
    // itself; `nightAt` pins the instant-to-night mapping.
    const bar = document.querySelector(`${august} .highcharts-point`);
    const { page } = await import('vitest/browser');
    await page.elementLocator(bar!).click();

    await expect.element(screen.getByTestId('night-timeline')).toBeVisible();
  });
});

describe('SemesterPage - the grid', () => {
  it('keeps the cell grid a click away, for counting nights down a column', async () => {
    const screen = await openSemester('/semester?site=GS&semester=2025B');
    await showGrid(screen);

    await expect.element(screen.getByRole('region', { name: 'August 2025' })).toBeVisible();
  });

  it('draws only one of the views at a time', async () => {
    const screen = await openSemester('/semester?site=GS&semester=2025B');
    await expect.element(screen.getByTestId('semester-timeline')).toBeVisible();

    await showGrid(screen);
    await expect.element(screen.getByTestId('semester-timeline')).not.toBeInTheDocument();
  });

  it('opens the night view when a cell is clicked', async () => {
    const screen = await renderApp({
      element: <SemesterPage />,
      route: '/semester?site=GS&semester=2025B',
      extraRoutes: [{ path: '/night', element: <NightPage /> }],
    });
    await showGrid(screen);
    const august = '[data-testid="semester-heatmap-August 2025"]';
    await expect.poll(() => document.querySelector(`${august} .highcharts-point`)).not.toBeNull();

    // The first cell of August is the evening of the 1st, the night labelled
    // the 2nd - a cell is one night, so the click is exact.
    const cell = document.querySelector(`${august} .highcharts-point`);
    const { page } = await import('vitest/browser');
    await page.elementLocator(cell!).click();

    await expect.element(screen.getByText('Night of 2025-08-02')).toBeVisible();
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

    // GS 2025B's first night is labelled 2025-08-02, which begins the evening of
    // 1 August - so the calendar lands on August whatever the wall clock says.
    // The night squares are the assertion: the printed title also exists as a
    // hidden native <option> inside the month picker, so text alone is ambiguous.
    await expect.element(screen.getByRole('button', { name: 'Open night beginning 2025-08-14' })).toBeVisible();
  });

  it('is a sendable link: view and month come from the URL', async () => {
    // No clicks: the URL alone lands on the calendar, open to November.
    const screen = await openSemester('/semester?site=GS&semester=2025B&view=calendar&month=2025-11');

    await expect.element(screen.getByTestId('semester-calendar')).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Open night beginning 2025-11-14' })).toBeVisible();
  });

  it('drops the month when leaving the calendar - chart and grid links carry just the semester', async () => {
    const screen = await openSemester('/semester?site=GS&semester=2025B&view=calendar&month=2025-11');
    await expect.element(screen.getByRole('button', { name: 'Open night beginning 2025-11-14' })).toBeVisible();

    await screen.getByRole('button', { name: 'Grid' }).click();
    await expect.element(screen.getByTestId('semester-heatmap')).toBeVisible();
    await screen.getByRole('button', { name: 'Calendar' }).click();

    // November is forgotten, not resurrected: the grid link had no month to
    // carry, so returning starts from the semester's first month.
    await expect.element(screen.getByRole('button', { name: 'Open night beginning 2025-08-14' })).toBeVisible();
  });

  it('drops the month when the semester changes - it named a page of the old one', async () => {
    // The semester control moved to the masthead, so the shell mounts around
    // the page - the way the application always renders it.
    const screen = await renderApp({
      element: <Layout />,
      route: '/semester?site=GS&semester=2025B&view=calendar&month=2025-11',
      path: '/',
      childRoutes: [{ path: 'semester', element: <SemesterPage /> }],
    });
    await expect.element(screen.getByRole('button', { name: 'Open night beginning 2025-11-14' })).toBeVisible();

    await selectDropdownOption(screen, 'Semester', '2025A');
    await expect.element(screen.getByRole('button', { name: 'Open night beginning 2025-02-14' })).toBeVisible();

    // Coming back, 2025B opens on its first month - November belonged to the
    // link that named it, not to the semester control.
    await selectDropdownOption(screen, 'Semester', '2025B');
    await expect.element(screen.getByRole('button', { name: 'Open night beginning 2025-08-14' })).toBeVisible();
  });

  it('reads an unknown month parameter as the first month, never an empty grid', async () => {
    // A stale month carried over from another semester must not strand the
    // reader outside the semester (I4: an empty grid reads as closed).
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

    // The reason the calendar exists next to two run views: per-night facts.
    // The moon is computed - the workbook prints no moon dates or holidays.
    await expect.element(screen.getByTestId('moon-disc').first()).toBeVisible();
    await expect.element(screen.getByText(/^\d+\.\d h$/).first()).toBeVisible();
  });

  it('draws the news as single-evening chips, never the steady run bars', async () => {
    // GN 2026B, August: the Port 1 swap is one chip naming both instruments
    // on the evening it happens; Altair and GMOS-N run the whole semester and
    // are furniture - the chart and grid state them, and drawing them here
    // buried the facts only the calendar carries (Dan, 2026-08-11).
    const screen = await openSemester('/semester?site=GN&semester=2026B&view=calendar');
    const calendar = screen.getByTestId('semester-calendar');

    await expect.element(calendar.getByText('IGRINS-2 → MAROON-X').first()).toBeVisible();
    await expect.element(calendar.getByText('Altair')).not.toBeInTheDocument();
    await expect.element(calendar.getByText('GMOS-N')).not.toBeInTheDocument();
  });

  it('chips a usability change by the new usage - the restriction is the news', async () => {
    // GNIRS is recorded Not Available 6-17 August 2026: one chip when it
    // fails, one when it returns to science.
    const screen = await openSemester('/semester?site=GN&semester=2026B&view=calendar');
    const calendar = screen.getByTestId('semester-calendar');

    await expect.element(calendar.getByText('GNIRS: Not available').first()).toBeVisible();
    await expect.element(calendar.getByText('GNIRS: Science').first()).toBeVisible();
  });

  it('chips the telescope closing and reopening, with the closed squares washed', async () => {
    // GN 2026B's late-October weather closure sits strictly inside the
    // semester, so both of its edges are news; the closed span itself is the
    // squares' wash, not a bar.
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

    // A closed square is mostly wash; hovering anywhere on it must still
    // surface the reason (PLAN.md §10). The bars and the date header carry
    // their own titles; this pins the background's.
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

    // The evening of 14 August begins the observing night labelled the 15th -
    // the whole square is the link, the date header is its accessible name.
    await screen.getByRole('button', { name: 'Open night beginning 2025-08-14' }).click();

    await expect.element(screen.getByText('Night of 2025-08-15')).toBeVisible();
  });

  it('replaces the other views rather than joining them', async () => {
    const screen = await openSemester('/semester?site=GS&semester=2025B');
    await showCalendar(screen);

    await expect.element(screen.getByTestId('semester-timeline')).not.toBeInTheDocument();
    await expect.element(screen.getByTestId('semester-heatmap')).not.toBeInTheDocument();
  });

  it('keeps the block table, which is the reading for every view', async () => {
    const screen = await openSemester('/semester?site=GS&semester=2025B');
    await showCalendar(screen);

    await expect.element(screen.getByTestId('semester-block-table')).toBeInTheDocument();
  });
});

/**
 * The reading for someone who cannot see any of the three pictures. It is not a
 * view, so it must be present whichever one is drawn.
 */
describe('SemesterPage - the block table', () => {
  it('states a run once, with its extent, rather than once per night', async () => {
    const screen = await openSemester('/semester?site=GS&semester=2025B');

    const table = screen.getByTestId('semester-block-table');
    await expect.element(table).toBeInTheDocument();
    // GHOST is one block from August to January, so it is one row - the whole
    // point of a block table over a cell grid.
    await expect.element(table.getByRole('row', { name: /Port 1 GHOST 1 Aug 2025/ })).toBeInTheDocument();
  });

  it('files a telescope-wide closure under no port, with the whole phrase', async () => {
    const screen = await openSemester('/semester?site=GS&semester=2024B');

    await expect
      .element(screen.getByTestId('semester-block-table').getByRole('row', { name: /Whole telescope/ }))
      .toBeInTheDocument();
  });

  it('stays present when the grid is showing', async () => {
    const screen = await openSemester('/semester?site=GS&semester=2025B');
    await showGrid(screen);

    await expect.element(screen.getByTestId('semester-block-table')).toBeInTheDocument();
  });
});

describe('SemesterPage - every published semester', () => {
  it('offers every semester Resource holds', async () => {
    const screen = await openSemester('/semester?site=GS&semester=2025A');

    await expect.element(screen.getByText('Gemini South Semester 2025A', { exact: false })).toBeVisible();
  });
});
