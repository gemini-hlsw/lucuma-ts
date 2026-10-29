import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';

import { buildSemesterTimeline } from '@/domain/semesterTimeline';
import { observingNightInterval } from '@/domain/siteTime';
import type { InstrumentAvailabilityBlock } from '@/domain/types';
import { buildWeekTimeline } from '@/domain/weekTimeline';
import { buildSemesterMonthOptions } from '@/features/semester/semesterMonthOptions';
import { buildWeekChartOptions } from '@/features/week/weekChartOptions';

import { TimelineChart } from './TimelineChart';

const night = (label: string) => observingNightInterval('GS', label);

/** Three rows whose blocks all begin the same night, which is the ordinary shape of a semester's first night. */
const month = buildSemesterTimeline({
  site: 'GS',
  firstNight: '2026-08-02',
  lastNight: '2026-09-01',
  instrumentAvailability: [
    {
      id: 'ghost',
      instrument: 'GHOST',
      publishedName: 'GHOST',
      usage: 'SCIENCE',
      port: 1,
      place: null,
      note: null,
      interval: { start: night('2026-08-02').start, end: night('2026-08-20').end },
    },
    {
      id: 'gmos',
      instrument: 'GMOS',
      publishedName: 'GMOS-S',
      usage: 'ENGINEERING',
      port: 2,
      place: null,
      note: null,
      interval: { start: night('2026-08-02').start, end: night('2026-08-30').end },
    },
  ],
  telescopeAvailability: [
    {
      id: 'open',
      availability: 'OPEN',
      port: null,
      reason: null,
      interval: { start: night('2026-08-02').start, end: night('2026-08-14').end },
    },
  ],
}).months[0]!;

const run = (id: string, instrument: 'GHOST' | 'GMOS', from: string, to: string): InstrumentAvailabilityBlock => ({
  id,
  instrument,
  publishedName: instrument,
  usage: 'SCIENCE',
  port: 1,
  place: null,
  note: null,
  interval: { start: night(from).start, end: night(to).end },
});

const weekChart = (firstNight: string, blocks: readonly InstrumentAvailabilityBlock[]) => {
  const week = buildWeekTimeline({
    site: 'GS',
    firstNight,
    instrumentAvailability: blocks,
    telescopeAvailability: [],
    nightsWithData: undefined,
  });
  return (
    <MemoryRouter>
      <div style={{ width: '900px' }}>
        <TimelineChart
          options={buildWeekChartOptions({ week, site: 'GS', now: null })}
          continuesLabel="continues"
          label="week"
          testId="chart"
        />
      </div>
    </MemoryRouter>
  );
};

const chart = (now: number) => (
  <MemoryRouter>
    <div style={{ width: '900px' }}>
      <TimelineChart
        options={buildSemesterMonthOptions({ month, site: 'GS', now })}
        continuesLabel="continues"
        label={month.label}
        testId="chart"
      />
    </div>
  </MemoryRouter>
);

/** Each bar's geometry and fill, with the pattern's per-render hash dropped. */
const drawnBars = () =>
  [...document.querySelectorAll('path.highcharts-point')].map(
    (bar) =>
      `${bar.getAttribute('d') ?? ''}#${(bar.getAttribute('fill') ?? '').replace(/pattern-\d+-\w+/u, 'pattern')}`,
  );

const drawnLabels = () =>
  [...document.querySelectorAll('.highcharts-data-label text')].map((label) => label.textContent?.trim() ?? '');

describe(TimelineChart, () => {
  it('redraws every block in place when the options change', async () => {
    const t0 = night('2026-08-10').start;
    const screen = await render(chart(t0));
    await expect.poll(() => drawnLabels()).toStrictEqual(['Open', 'GHOST', 'GMOS-S']);
    const bars = drawnBars();
    expect(bars).toHaveLength(3);

    await screen.rerender(chart(t0 + 5 * 60_000));

    await expect.poll(() => drawnLabels()).toStrictEqual(['Open', 'GHOST', 'GMOS-S']);
    await expect.poll(() => drawnBars()).toStrictEqual(bars);
  });

  /* The week page's sequence: a loading week draws empty, the next week draws one run, and stepping back redraws the cached one. */
  it('draws other data on the right rows after a window change', async () => {
    const ghost = run('ghost', 'GHOST', '2024-08-02', '2024-08-14');
    const gmos = run('gmos', 'GMOS', '2024-08-15', '2024-09-30');
    const screen = await render(weekChart('2024-08-12', [ghost, gmos]));
    await expect.poll(() => drawnLabels()).toStrictEqual(['GHOST', 'GMOS']);
    const home = drawnBars();

    await screen.rerender(weekChart('2024-08-19', []));
    await expect.poll(() => drawnBars()).toStrictEqual([]);
    await screen.rerender(weekChart('2024-08-19', [gmos]));
    await expect.poll(() => drawnLabels()).toStrictEqual(['GMOS']);
    await screen.rerender(weekChart('2024-08-12', [ghost, gmos]));

    await expect.poll(() => drawnLabels()).toStrictEqual(['GHOST', 'GMOS']);
    await expect.poll(() => drawnBars()).toStrictEqual(home);
  });
});
