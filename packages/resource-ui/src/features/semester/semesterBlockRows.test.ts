import { describe, expect, it } from 'vitest';

import { buildSemesterTimeline } from '@/domain/semesterTimeline';
import type { InstrumentAvailabilityBlock, Schedule } from '@/domain/types';
import { domainInstrumentBlock, domainTelescopeClosure, nightsSpan, scheduleOf } from '@/test/fixtures/domain';

import { buildBlockRows, WHOLE_TELESCOPE } from './semesterBlockRows';

const SITE = 'GS' as const;

const nights = (first: string, last: string) => nightsSpan(SITE, first, last);

const instrumentBlock = (over: Partial<InstrumentAvailabilityBlock> = {}): InstrumentAvailabilityBlock =>
  domainInstrumentBlock({ id: 'm1', port: 3, interval: nights('2026-08-08', '2026-08-14'), ...over });

interface Span {
  readonly firstNight: string;
  readonly lastNight: string;
}
const ONE_WEEK: Span = { firstNight: '2026-08-08', lastNight: '2026-08-14' };

const build = (over: Partial<Schedule> = {}, span: Span = ONE_WEEK) =>
  buildBlockRows(
    buildSemesterTimeline({
      site: SITE,
      ...span,
      schedule: scheduleOf({ instrumentAvailability: [instrumentBlock()], ...over }),
    }),
    SITE,
  );

describe(buildBlockRows, () => {
  it('states a run once with its extent, not once per night', () => {
    const rows = build();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      rowLabel: 'Port 3',
      subject: 'GMOS',
      from: '7 Aug 2026',
      to: '13 Aug 2026',
      nights: '7 nights',
    });
  });

  it('keeps a run that crosses a month boundary as one row', () => {
    const rows = build(
      { instrumentAvailability: [instrumentBlock({ interval: nights('2026-08-08', '2026-10-14') })] },
      { firstNight: '2026-08-08', lastNight: '2026-10-14' },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ from: '7 Aug 2026', to: '13 Oct 2026' });
  });

  it('files a telescope-wide closure under no port, with the whole phrase', () => {
    const telescopeBlock = domainTelescopeClosure({
      id: 'wide',
      interval: nights('2026-08-08', '2026-08-10'),
      reason: 'Telescope Shutdown A&G Maintenance',
    });

    const band = build({ instrumentAvailability: [], telescopeAvailability: [telescopeBlock] }).find(
      (row) => row.rowLabel === WHOLE_TELESCOPE,
    );
    expect(band).toMatchObject({ subject: 'Telescope Shutdown A&G Maintenance', nights: '3 nights' });
  });

  it('names an unlabelled absence rather than leaving the cell blank', () => {
    const telescopeBlock = domainTelescopeClosure({ id: 'p4', port: 4, interval: nights('2026-08-08', '2026-08-08') });

    const rows = build({ instrumentAvailability: [], telescopeAvailability: [telescopeBlock] });
    expect(rows[0]).toMatchObject({ rowLabel: 'Port 4', subject: 'No instrument scheduled', nights: '1 night' });
  });
});
