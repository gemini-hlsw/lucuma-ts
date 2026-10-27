import { describe, expect, it } from 'vitest';

import type { InstrumentAvailabilityBlock, InstrumentComponent, InstrumentComponentAvailabilityBlock } from './types';
import { buildWeekChanges } from './weekBriefing';
import { buildWeekTimeline } from './weekTimeline';

/** `nightsWithData: undefined` leaves every night of the week recorded. */
const week = buildWeekTimeline({
  site: 'GS',
  firstNight: '2026-11-22',
  instrumentAvailability: [],
  telescopeAvailability: [],
  nightsWithData: undefined,
});

describe('the changes list', () => {
  const DAY = 86_400_000;
  const { interval } = week;

  const instrumentBlock = (
    over: Partial<InstrumentAvailabilityBlock> & Pick<InstrumentAvailabilityBlock, 'id' | 'interval'>,
  ): InstrumentAvailabilityBlock => ({
    instrument: 'GMOS',
    publishedName: 'GMOS',
    usage: 'SCIENCE',
    port: 3,
    place: null,
    note: null,
    ...over,
  });

  it('lists a run beginning and a run ending inside the week, oldest first', () => {
    const changes = buildWeekChanges({
      interval,
      instrumentAvailability: [
        instrumentBlock({ id: 'ends', interval: { start: interval.start - 30 * DAY, end: interval.start + DAY } }),
        instrumentBlock({
          id: 'begins',
          publishedName: 'Maroon-X Run',
          port: 5,
          interval: { start: interval.start + 3 * DAY, end: interval.end + 30 * DAY },
        }),
      ],
      telescopeAvailability: [],
      componentAvailability: [],
      components: [],
    });

    expect(changes.map((change) => change.kind)).toEqual(['RUN_ENDS', 'RUN_BEGINS']);
    expect(changes[1]).toMatchObject({ label: 'Maroon-X Run', rowLabel: 'Port 5' });
  });

  it('does not call a boundary at the window’s edge a change', () => {
    // A run that began exactly as the week opened merely continues.
    const changes = buildWeekChanges({
      interval,
      instrumentAvailability: [
        instrumentBlock({ id: 'continues', interval: { start: interval.start, end: interval.end } }),
      ],
      telescopeAvailability: [],
      componentAvailability: [],
      components: [],
    });

    expect(changes).toEqual([]);
  });

  it('phrases a closure by its printed reason', () => {
    const changes = buildWeekChanges({
      interval,
      instrumentAvailability: [],
      telescopeAvailability: [
        {
          id: 'shutdown',
          availability: 'CLOSED',
          port: null,
          reason: 'Telescope Shutdown',
          interval: { start: interval.start + DAY, end: interval.start + 2 * DAY },
        },
      ],
      componentAvailability: [],
      components: [],
    });

    expect(changes.map((change) => change.kind)).toEqual(['CLOSURE_BEGINS', 'CLOSURE_ENDS']);
    expect(changes[0]).toMatchObject({ label: 'Telescope Shutdown', rowLabel: null });
  });

  it('announces the state a component enters, with its note', () => {
    const r400: InstrumentComponent = {
      id: 'k-gs-R400_G5325',
      instrument: 'GMOS',
      componentType: 'DISPERSER',
      code: 'R400_G5325',
      name: 'R400',
      barcode: null,
      aliases: [],
    };
    const failsAt = interval.start + 2 * DAY;
    const blocks: readonly InstrumentComponentAvailabilityBlock[] = [
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
      instrumentAvailability: [],
      telescopeAvailability: [],
      componentAvailability: blocks,
      components: [r400],
    });

    // One change, not two: "nothing recorded" is never a state to announce (I4).
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
