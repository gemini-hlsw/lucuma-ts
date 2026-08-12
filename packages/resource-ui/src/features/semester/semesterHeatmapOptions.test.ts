import type { YAxisOptions } from 'highcharts';
import { describe, expect, it } from 'vitest';

import type { SemesterCell, SemesterCellRow } from '@/domain/semesterCells';
import type { TimelineBand, TimelineNight } from '@/domain/timeline';

import {
  buildClosureBands,
  buildHeatmapPoints,
  buildSemesterHeatmapOptions,
  buildWeekendBands,
  cellBorder,
  cellColor,
  cellInk,
  dayTickPositions,
} from './semesterHeatmapOptions';

const cell = (over: Partial<SemesterCell> = {}): SemesterCell => ({
  observingNight: '2026-08-08',
  eveningDate: '2026-08-07',
  kind: 'MOUNTED',
  instrument: 'GMOS',
  usage: 'SCIENCE',
  label: 'GMOS',
  description: 'Port 3: GMOS, night of 2026-08-07',
  isWeekend: false,
  notable: false,
  startsRun: true,
  runLength: 1,
  labelSpan: 1,
  ...over,
});

const row = (cells: readonly SemesterCell[], label = 'Port 3'): SemesterCellRow => ({ key: label, label, cells });

describe('cellColor', () => {
  it('gives a mounted night its instrument hue, which is the point of the view', () => {
    // The sheet encodes identity as colour, so this does too. The version this
    // replaces spent colour on availability and came out one shade of green.
    expect(cellColor(cell({ instrument: 'GMOS' }))).toBe('var(--instrument-gmos)');
    expect(cellColor(cell({ instrument: 'GHOST' }))).not.toBe(cellColor(cell({ instrument: 'GMOS' })));
  });

  it('never gives an absence or a closure an instrument hue', () => {
    const instrumentHue = cellColor(cell());
    for (const kind of ['UNSCHEDULED', 'CLOSED', 'MIXED', 'EMPTY'] as const) {
      expect(cellColor(cell({ kind, instrument: null }))).not.toBe(instrumentHue);
    }
  });

  it('draws an unrecorded night and an unscheduled one alike, differing only in the tooltip', () => {
    // Inventing a fill for "nothing recorded" would make a gap look like a state,
    // which invariant I4 forbids.
    expect(cellColor(cell({ kind: 'EMPTY', instrument: null }))).toBe(
      cellColor(cell({ kind: 'UNSCHEDULED', instrument: null })),
    );
  });
});

describe('cellInk', () => {
  it('takes the ink measured for the fill, never one fixed colour', () => {
    // White on GSAOI's lime manages 1.3:1 - the first version of this view
    // wrote every label in the timeline text colour and lost the bright cells.
    expect(cellInk(cell({ instrument: 'GSAOI', label: 'GSAOI' }))).toBe('var(--instrument-ink-dark)');
    expect(cellInk(cell({ instrument: 'ALTAIR', label: 'Altair' }))).toBe('var(--instrument-ink-light)');
  });

  it('writes absences muted and the chrome washes in full text, as the xrange does', () => {
    expect(cellInk(cell({ kind: 'UNSCHEDULED', instrument: null }))).toBe('var(--timeline-muted-text)');
    expect(cellInk(cell({ kind: 'EMPTY', instrument: null }))).toBe('var(--timeline-muted-text)');
    expect(cellInk(cell({ kind: 'CLOSED', instrument: null }))).toBe('var(--timeline-text)');
    expect(cellInk(cell({ kind: 'MIXED', instrument: null }))).toBe('var(--timeline-text)');
  });
});

describe('buildHeatmapPoints', () => {
  it('lays cells out one column per night and one row per subject', () => {
    const points = buildHeatmapPoints([row([cell(), cell()]), row([cell(), cell()], 'Port 4')]);

    expect(points.map((point) => [point.x, point.y])).toEqual([
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ]);
  });

  it('offers a label only where a run begins, so a run is named once', () => {
    const points = buildHeatmapPoints([
      row([
        cell({ startsRun: true, runLength: 3, labelSpan: 3 }),
        cell({ startsRun: false }),
        cell({ startsRun: false }),
      ]),
    ]);

    expect(points.map((point) => point.custom.labelSpan)).toEqual([3, 0, 0]);
  });

  it('names an unlabelled absence rather than carrying an empty string to the tooltip', () => {
    const points = buildHeatmapPoints([row([cell({ kind: 'UNSCHEDULED', instrument: null, label: '' })])]);

    expect(points[0]?.custom.label).toBe('No instrument scheduled');
  });

  it('inks each label for its own fill', () => {
    const points = buildHeatmapPoints([row([cell({ instrument: 'GSAOI' }), cell({ instrument: 'ALTAIR' })])]);

    expect(points.map((point) => point.dataLabels)).toEqual([
      { style: { color: 'var(--instrument-ink-dark)' } },
      { style: { color: 'var(--instrument-ink-light)' } },
    ]);
  });

  it('keeps a dark-ink label on its own run instead of spilling onto the dark ghost cells', () => {
    // "GSAOI" wider than a one-night run would start on the lime and finish
    // invisible on the near-black cells after it; better dropped for the tooltip.
    const points = buildHeatmapPoints([
      row([
        cell({ instrument: 'GSAOI', label: 'GSAOI', runLength: 1, labelSpan: 3 }),
        cell({ kind: 'UNSCHEDULED', instrument: null, label: '', runLength: 2, labelSpan: 2 }),
        cell({ kind: 'UNSCHEDULED', instrument: null, label: '', startsRun: false }),
      ]),
    ]);

    expect(points[0]?.custom.labelSpan).toBe(1);
  });

  it('lets a light-ink label keep the spill, since the ghost cells it crosses are dark too', () => {
    const points = buildHeatmapPoints([
      row([cell({ instrument: 'ALTAIR', label: 'Altair', runLength: 1, labelSpan: 3 })]),
    ]);

    expect(points[0]?.custom.labelSpan).toBe(3);
  });
});

describe('buildWeekendBands', () => {
  it('covers the weekend column rather than sitting on its boundary', () => {
    const bands = buildWeekendBands([cell(), cell({ isWeekend: true }), cell()]);

    expect(bands).toHaveLength(1);
    expect(bands[0]).toMatchObject({ from: 0.5, to: 1.5 });
  });
});

describe('dayTickPositions', () => {
  it('always numbers the first night, so a month starts from a known day', () => {
    for (const step of [1, 2, 5]) {
      expect(dayTickPositions(31, step)[0]).toBe(0);
    }
  });

  it('thins deterministically rather than leaving Highcharts to drop on collision', () => {
    // Left alone Highcharts numbers days 1 to 9 and then nothing at all.
    expect(dayTickPositions(10, 2)).toEqual([0, 2, 4, 6, 8]);
    expect(dayTickPositions(10, 5)).toEqual([0, 5]);
  });
});

describe('buildClosureBands', () => {
  // Three abutting synthetic nights; the closure spans the middle one.
  const NIGHT_MS = 24 * 3_600_000;
  const nights: TimelineNight[] = Array.from({ length: 3 }, (_, index) => ({
    observingNight: `2026-08-0${String(index + 2)}`,
    eveningDate: `2026-08-0${String(index + 1)}`,
    interval: { start: index * NIGHT_MS, end: (index + 1) * NIGHT_MS },
    isWeekend: false,
    dataAvailable: true,
  }));
  const band = (first: number, last: number, label: string): TimelineBand => ({
    id: `b-${String(first)}`,
    interval: { start: first * NIGHT_MS, end: (last + 1) * NIGHT_MS },
    label,
  });

  it('washes the columns the closure touches and writes the phrase once', () => {
    // The same wash every chart view gives a closure - the cells beneath keep
    // their own records, and the reason is read once, not once per row.
    const bands = buildClosureBands(nights, [band(0, 1, 'Telescope Shutdown A&G Maintenance')]);

    expect(bands).toHaveLength(1);
    expect(bands[0]).toMatchObject({ from: -0.5, to: 1.5, color: 'var(--schedule-band)' });
    expect(bands[0]?.label?.text).toBe('Telescope Shutdown A&G Maintenance');
  });

  it('keeps two separate closures separate', () => {
    const bands = buildClosureBands(nights, [band(0, 0, 'A'), band(2, 2, 'B')]);

    expect(bands).toHaveLength(2);
    expect(bands.map((entry) => entry.label?.text)).toEqual(['A', 'B']);
    expect(bands[1]).toMatchObject({ from: 1.5, to: 2.5 });
  });

  it('draws nothing when nothing is closed', () => {
    expect(buildClosureBands(nights, [])).toEqual([]);
  });
});

describe('the telescope-state rows on the grid', () => {
  const stateCell = (label: string, notable: boolean): SemesterCell =>
    cell({ kind: 'STATE', instrument: null, label, notable });
  const closed = (label: string) => cell({ kind: 'CLOSED', instrument: null, label });

  it('fills a state cell with the neutral for its standing, never a hue', () => {
    expect(cellColor(stateCell('Standard ToOs', false))).toBe('var(--state-routine)');
    expect(cellColor(stateCell('Classical', true))).toBe('var(--state-notable)');
    expect(cellInk(stateCell('Classical', true))).toBe('var(--instrument-ink-dark)');
  });

  it('treats usability as a treatment over the identity hue, never a second palette', () => {
    // Engineering use: the instrument's hue hatched with its measured ink.
    const engineering = cellColor(cell({ usage: 'ENGINEERING' }));
    expect(engineering).toMatchObject({
      pattern: { backgroundColor: 'var(--instrument-gmos)', color: 'var(--instrument-ink-dark)' },
    });
    // Not available: hollow, the hue on the outline, the label muted.
    expect(cellColor(cell({ usage: 'UNAVAILABLE' }))).toBe('transparent');
    expect(cellBorder(cell({ usage: 'UNAVAILABLE' }))).toBe('var(--instrument-gmos)');
    expect(cellInk(cell({ usage: 'UNAVAILABLE' }))).toBe('var(--timeline-muted-text)');
  });

  it('names each group above its rows and fills the Telescope row Closed cell red', () => {
    const options = buildSemesterHeatmapOptions({
      rows: [row([stateCell('No ToOs', true), stateCell('No ToOs', true)], 'ToO'), row([cell(), cell()], 'Port 3')],
      nights: [],
      bands: [],
      site: 'GS',
      seriesName: 'August 2026',
    });

    expect(cellColor(closed('Shutdown'))).toBe('var(--schedule-closed)');

    // The same group headings the xrange charts draw.
    const yAxis = options.yAxis as YAxisOptions;
    expect(yAxis.categories).toEqual(['Telescope', 'ToO', 'Instruments', 'Port 3']);
  });
});
