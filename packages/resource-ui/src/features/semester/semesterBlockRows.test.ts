import { describe, expect, it } from 'vitest';

import { buildSemesterTimeline } from '@/domain/semesterTimeline';
import { observingNightInterval } from '@/domain/siteTime';
import type { Closure, Mounting } from '@/domain/types';

import { buildBlockRows, WHOLE_TELESCOPE } from './semesterBlockRows';

const SITE = 'GS' as const;

const nights = (first: string, last: string) => ({
  start: observingNightInterval(SITE, first).start,
  end: observingNightInterval(SITE, last).end,
});

const mounting = (over: Partial<Mounting> = {}): Mounting => ({
  id: 'm1',
  instrument: 'GMOS',
  publishedName: 'GMOS',
  usage: 'SCIENCE',
  rowLabel: 'Port 3',
  port: 3,
  interval: nights('2026-08-08', '2026-08-14'),
  note: null,
  ...over,
});

const build = (over: Partial<Parameters<typeof buildSemesterTimeline>[0]> = {}) =>
  buildBlockRows(
    buildSemesterTimeline({
      site: SITE,
      rowLabels: ['Port 3', 'Port 4'],
      firstNight: '2026-08-08',
      lastNight: '2026-08-14',
      mountings: [mounting()],
      closures: [],
      ...over,
    }),
    SITE,
  );

describe('buildBlockRows', () => {
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
    // The importer merges GHOST across the sheet's month blocks, and the table
    // has to preserve that or a reader gets six rows for one fact.
    const rows = build({
      firstNight: '2026-08-08',
      lastNight: '2026-10-14',
      mountings: [mounting({ interval: nights('2026-08-08', '2026-10-14') })],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ from: '7 Aug 2026', to: '13 Oct 2026' });
  });

  it('files a telescope-wide closure under no port, with the whole phrase', () => {
    const closure: Closure = {
      id: 'wide',
      availability: 'CLOSED',
      port: null,
      interval: nights('2026-08-08', '2026-08-10'),
      reason: 'Telescope Shutdown A&G Maintenance',
    };

    const band = build({ mountings: [], closures: [closure] }).find((row) => row.rowLabel === WHOLE_TELESCOPE);
    expect(band).toMatchObject({ subject: 'Telescope Shutdown A&G Maintenance', nights: '3 nights' });
  });

  it('names an unlabelled absence rather than leaving the cell blank', () => {
    const closure: Closure = {
      id: 'p4',
      availability: 'CLOSED',
      port: 4,
      interval: nights('2026-08-08', '2026-08-08'),
      reason: null,
    };

    const rows = build({ mountings: [], closures: [closure] });
    expect(rows[0]).toMatchObject({ rowLabel: 'Port 4', subject: 'No instrument scheduled', nights: '1 night' });
  });
});
