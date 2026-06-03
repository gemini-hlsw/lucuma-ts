import { describe, expect, it } from 'vitest';

import { toTimelineRows } from './adapters';
import { createTelescopeNightTimeline, timelineFactory } from '../../test/factories';

describe(toTimelineRows.name, () => {
  it('creates the mode row', () => {
    const timeline = createTelescopeNightTimeline({
      modes: [timelineFactory.modeStatus('QUEUE', '2026-08-01T19:00:00-10:00', '2026-08-01T21:00:00-10:00')],
    });

    expect(toTimelineRows(timeline)[0]).toEqual({
      id: 'mode',
      label: 'MODE',
      blocks: [
        {
          id: 'mode-0-2026-08-01T19:00:00-10:00',
          interval: {
            __typename: 'TimestampInterval',
            start: '2026-08-01T19:00:00-10:00',
            end: '2026-08-01T21:00:00-10:00',
          },
          label: 'QUEUE',
          variant: 'queue',
        },
      ],
    });
  });

  it('creates the telescope availability row', () => {
    const timeline = createTelescopeNightTimeline({
      availability: [
        timelineFactory.availabilityStatus('OPEN', '2026-08-01T19:00:00-10:00', '2026-08-02T08:00:00-10:00'),
      ],
    });

    expect(toTimelineRows(timeline)[1]).toEqual({
      id: 'availability',
      label: 'TELESCOPE',
      blocks: [
        {
          id: 'availability-0-2026-08-01T19:00:00-10:00',
          interval: {
            __typename: 'TimestampInterval',
            start: '2026-08-01T19:00:00-10:00',
            end: '2026-08-02T08:00:00-10:00',
          },
          label: 'OPEN',
          variant: 'open',
        },
      ],
    });
  });

  it('creates the ToO support row', () => {
    const timeline = createTelescopeNightTimeline({
      tooStatus: [timelineFactory.tooStatus('RAPID', '2026-08-01T22:00:00-10:00', '2026-08-02T01:00:00-10:00')],
    });

    expect(toTimelineRows(timeline)[2]).toEqual({
      id: 'too',
      label: 'ToO',
      blocks: [
        {
          id: 'too-0-2026-08-01T22:00:00-10:00',
          interval: {
            __typename: 'TimestampInterval',
            start: '2026-08-01T22:00:00-10:00',
            end: '2026-08-02T01:00:00-10:00',
          },
          label: 'RAPID',
          variant: 'too',
        },
      ],
    });
  });

  it('maps NONE ToO support to the unknown variant', () => {
    const timeline = createTelescopeNightTimeline({
      tooStatus: [timelineFactory.tooStatus('NONE', '2026-08-01T19:00:00-10:00', '2026-08-02T08:00:00-10:00')],
    });

    expect(toTimelineRows(timeline)[2].blocks[0]).toMatchObject({
      label: 'NONE',
      variant: 'unknown',
    });
  });
});
