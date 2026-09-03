import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

import { toMountings, toPublishedSemesters } from './adapters';

type Block = Parameters<typeof toMountings>[0][number];

/** The warning dedupes on `publishedName` in a set nothing clears, so each test needs a fresh name. */
const block = (location: Block['location'], publishedName = 'GMOS-S'): Block => ({
  __typename: 'InstrumentAvailabilityBlock',
  instrument: 'GMOS',
  publishedName,
  usage: 'SCIENCE',
  note: null,
  interval: { __typename: 'TimestampInterval', start: '2026-08-09T18:00:00Z', end: '2026-08-10T18:00:00Z' },
  location,
});

/** `toMountings` is where the wire's port/place promise is checked; these are its three outcomes. */
describe(toMountings, () => {
  let warn: MockInstance<typeof console.warn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('reads a PORT record as a port and no place', () => {
    const [mounting] = toMountings([block({ __typename: 'InstrumentLocation', place: 'PORT', port: 3 })]);

    expect(mounting).toMatchObject({ port: 3, place: null });
    expect(warn).not.toHaveBeenCalled();
  });

  it('reads any other place as a place and no port', () => {
    const [mounting] = toMountings([block({ __typename: 'InstrumentLocation', place: 'LAB', port: null })]);

    expect(mounting).toMatchObject({ port: null, place: 'LAB' });
    expect(warn).not.toHaveBeenCalled();
  });

  it('reads a PORT record with no port number as off-port, and says so', () => {
    // It must not throw - one bad record would empty a night - and must not pass silently.
    const [mounting] = toMountings([block({ __typename: 'InstrumentLocation', place: 'PORT', port: null })]);

    expect(mounting).toMatchObject({ port: null, place: 'UNKNOWN' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('GMOS-S');
  });

  it('says it once per instrument, however many of its records are wrong', () => {
    // One line per broken instrument is a warning; one per record buries the console.
    const wrong = { __typename: 'InstrumentLocation', place: 'PORT', port: null } as const;
    const mountings = toMountings([block(wrong, 'GNIRS'), block(wrong, 'GNIRS'), block(wrong, 'NIFS')]);

    expect(mountings.map((mounting) => mounting.place)).toEqual(['UNKNOWN', 'UNKNOWN', 'UNKNOWN']);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(String(warn.mock.calls[0]?.[0])).toContain('GNIRS');
    expect(String(warn.mock.calls[1]?.[0])).toContain('NIFS');
  });
});

type SemesterEntry = Parameters<typeof toPublishedSemesters>[0]['publishedSemesters'][number];

const semesterEntry = (nights: SemesterEntry['nights']): SemesterEntry => ({
  __typename: 'PublishedSemester',
  site: 'GS',
  semester: '2025B',
  title: 'GS 2025B Schedule',
  version: null,
  demo: false,
  nights,
  holidays: [],
  moonEvents: [],
});

/** The one place the API's half-open `nights` becomes the domain's inclusive first/last night. */
describe(toPublishedSemesters, () => {
  it('reads the exclusive nights end as the last night before it', () => {
    // The exclusive end names the first uncovered date; passing it through adds a night that was never scheduled.
    const [semester] = toPublishedSemesters({
      publishedSemesters: [semesterEntry({ __typename: 'DateInterval', start: '2025-08-01', end: '2026-02-01' })],
    });

    expect(semester).toMatchObject({ firstNight: '2025-08-01', lastNight: '2026-01-31' });
  });
});
