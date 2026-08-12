import { describe, expect, it } from 'vitest';

import type { ComponentBlock, ComponentRecord, Mounting } from './types';
import { buildWeekChanges, buildWeekNightFacts, summarizeWeek } from './weekBriefing';
import { buildWeekTimeline } from './weekTimeline';

/** The week the synthetic R400 failure falls in, all seven nights recorded. */
const week = buildWeekTimeline({
  site: 'GS',
  firstNight: '2026-11-22',
  rowLabels: [],
  mountings: [],
  closures: [],
  nightsWithData: undefined,
});

describe('the nightly facts', () => {
  it('carries one entry per night, in the chart’s own order', () => {
    const facts = buildWeekNightFacts({ site: 'GS', nights: week.nights, holidays: [], moonEvents: [] });

    expect(facts.map((fact) => fact.observingNight)).toEqual([
      '2026-11-22',
      '2026-11-23',
      '2026-11-24',
      '2026-11-25',
      '2026-11-26',
      '2026-11-27',
      '2026-11-28',
    ]);
    // A November night at Cerro Pachon has real astronomical dark, but summer
    // is closing in - somewhere in single digits.
    for (const fact of facts) {
      expect(fact.darkHours).toBeGreaterThan(4);
      expect(fact.darkHours).toBeLessThan(12);
    }
  });

  it('marks holidays and printed moon dates by the evening a night begins', () => {
    const facts = buildWeekNightFacts({
      site: 'GS',
      nights: week.nights,
      // The night labelled the 22nd begins on the evening of the 21st.
      holidays: ['2026-11-21'],
      moonEvents: [{ date: '2026-11-24', phase: 'FULL' }],
    });

    expect(facts[0]?.isHoliday).toBe(true);
    expect(facts[1]?.isHoliday).toBe(false);
    expect(facts.find((fact) => fact.eveningDate === '2026-11-24')?.publishedMoon).toBe('FULL');
  });

  it('sums the dark and brackets the moon for the header', () => {
    const facts = buildWeekNightFacts({ site: 'GS', nights: week.nights, holidays: [], moonEvents: [] });
    const summary = summarizeWeek(facts);

    expect(summary?.totalDarkHours).toBeCloseTo(
      facts.reduce((sum, fact) => sum + (fact.darkHours ?? 0), 0),
      6,
    );
    expect(summary?.moonStart).toEqual(facts[0]?.moon);
    expect(summary?.moonEnd).toEqual(facts.at(-1)?.moon);
  });
});

describe('the changes list', () => {
  const DAY = 86_400_000;
  const { interval } = week;

  const mounting = (over: Partial<Mounting> & Pick<Mounting, 'id' | 'interval'>): Mounting => ({
    rowLabel: 'Port 3',
    instrument: 'GMOS',
    publishedName: 'GMOS',
    usage: 'SCIENCE',
    port: 3,
    locationType: 'PORT',
    note: null,
    ...over,
  });

  it('lists a run beginning and a run ending inside the week, oldest first', () => {
    const changes = buildWeekChanges({
      interval,
      mountings: [
        mounting({ id: 'ends', interval: { start: interval.start - 30 * DAY, end: interval.start + DAY } }),
        mounting({
          id: 'begins',
          publishedName: 'Maroon-X Run',
          rowLabel: 'Visiting',
          interval: { start: interval.start + 3 * DAY, end: interval.end + 30 * DAY },
        }),
      ],
      closures: [],
      componentBlocks: [],
      components: [],
    });

    expect(changes.map((change) => change.kind)).toEqual(['RUN_ENDS', 'RUN_BEGINS']);
    expect(changes[1]).toMatchObject({ label: 'Maroon-X Run', rowLabel: 'Visiting' });
  });

  it('does not call a boundary at the window’s edge a change', () => {
    // A run that began exactly as the week opened merely continues.
    const changes = buildWeekChanges({
      interval,
      mountings: [mounting({ id: 'continues', interval: { start: interval.start, end: interval.end } })],
      closures: [],
      componentBlocks: [],
      components: [],
    });

    expect(changes).toEqual([]);
  });

  it('phrases a closure by its printed reason', () => {
    const changes = buildWeekChanges({
      interval,
      mountings: [],
      closures: [
        {
          id: 'shutdown',
          availability: 'CLOSED',
          port: null,
          reason: 'Telescope Shutdown',
          interval: { start: interval.start + DAY, end: interval.start + 2 * DAY },
        },
      ],
      componentBlocks: [],
      components: [],
    });

    expect(changes.map((change) => change.kind)).toEqual(['CLOSURE_BEGINS', 'CLOSURE_ENDS']);
    expect(changes[0]).toMatchObject({ label: 'Telescope Shutdown', rowLabel: null });
  });

  it('announces the state a component enters, with its note', () => {
    const r400: ComponentRecord = {
      id: 'k-gs-R400_G5325',
      instrument: 'GMOS',
      componentType: 'DISPERSER',
      code: 'R400_G5325',
      name: 'R400',
      barcode: null,
      aliases: [],
    };
    const failsAt = interval.start + 2 * DAY;
    const blocks: readonly ComponentBlock[] = [
      {
        id: 'up',
        componentId: r400.id,
        usage: 'SCIENCE',
        location: 'INSTALLED',
        interval: { start: interval.start - 30 * DAY, end: failsAt },
        note: null,
      },
      {
        id: 'down',
        componentId: r400.id,
        usage: 'UNAVAILABLE',
        location: 'LAB',
        interval: { start: failsAt, end: interval.end + 30 * DAY },
        note: 'Failed; removed for repair',
      },
    ];

    const changes = buildWeekChanges({
      interval,
      mountings: [],
      closures: [],
      componentBlocks: blocks,
      components: [r400],
    });

    // One change, not two: the record that ends is not phrased, the state that
    // begins is - "nothing recorded" is never a state to announce (I4).
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      kind: 'COMPONENT',
      instant: failsAt,
      location: 'LAB',
      usage: 'UNAVAILABLE',
      note: 'Failed; removed for repair',
    });
  });
});
