import { graphql } from 'graphql';
import { maskError } from 'graphql-yoga';
import { describe, expect, it } from 'vitest';

import sdl from '../src/gql/gen/schema.graphql?raw';
import { buildMockSchema } from './schema.ts';

const { schema } = buildMockSchema(sdl);

const run = async (source: string, variableValues?: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const result = await graphql({ schema, source, variableValues });
  expect(result.errors).toBeUndefined();
  return result.data ?? {};
};

/** `run`'s counterpart for the designed errors: the message, not the data. */
const runExpectingError = async (source: string, variableValues?: Record<string, unknown>): Promise<string> => {
  const result = await graphql({ schema, source, variableValues });
  const [error] = result.errors ?? [];
  expect(error).toBeDefined();
  return error?.message ?? '';
};

/** Written out rather than taken from src/gql/gen: these tests run raw documents against the schema. */
interface BlockLocation {
  readonly place: string;
  readonly port: number | null;
}

/** The selection every location assertion below shares. */
const LOCATION = 'location { place port }';

describe('TimestampInterval - the type the ODB schema shares', () => {
  const INTERVAL = `
    query ($site: Site!, $night: Date!) {
      telescopeNight(site: $site, observingNight: $night) {
        interval { start end duration { microseconds seconds hours iso } }
      }
    }`;

  const intervalOn = async (site: string, night: string): Promise<Record<string, never>> => {
    const data = await run(INTERVAL, { site, night });
    return (data.telescopeNight as { interval: Record<string, never> }).interval;
  };

  it('prints timestamps in the ODB scalar format, with no millisecond fraction', async () => {
    const interval = await intervalOn('GS', '2026-08-08');

    // toISOString() and the fixtures both carry a ".000", which the real service does not send.
    const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
    expect(interval.start).toMatch(iso);
    expect(interval.end).toMatch(iso);
  });

  it('carries the duration the ODB type carries, in every unit', async () => {
    const { duration } = (await intervalOn('GS', '2026-08-08')) as unknown as {
      duration: { microseconds: number; seconds: number; hours: number; iso: string };
    };

    expect(duration).toEqual({ microseconds: 86_400_000_000, seconds: 86_400, hours: 24, iso: 'PT24H' });
  });

  it('measures the night rather than assuming 24 hours, so a DST night is short', async () => {
    // Chile springs forward inside the night labelled 2026-09-06, so 14:00 to 14:00 local is 23 hours.
    const { duration } = (await intervalOn('GS', '2026-09-06')) as unknown as {
      duration: { hours: number; iso: string };
    };

    expect(duration.hours).toBe(23);
    expect(duration.iso).toBe('PT23H');
  });
});

describe('publishedSemesters', () => {
  it('offers every semester the workbook holds, for the site + semester picker', async () => {
    const data = await run('{ publishedSemesters { site semester title version nights { start end } } }');
    const sets = data.publishedSemesters as { site: string; semester: string }[];

    // GS runs 2024B through 2026A, GN through 2026B; GN's single 2027A evening is an export artifact.
    expect(sets).toHaveLength(9);
    expect(sets.map((set) => `${set.site}${set.semester}`).sort()).toEqual([
      'GN2024B',
      'GN2025A',
      'GN2025B',
      'GN2026A',
      'GN2026B',
      'GS2024B',
      'GS2025A',
      'GS2025B',
      'GS2026A',
    ]);
  });

  it('describes a semester by what it holds, not by the calendar', async () => {
    const data = await run('{ publishedSemesters { site semester nights { start end } } }');
    const sets = data.publishedSemesters as {
      site: string;
      semester: string;
      nights: { start: string; end: string };
    }[];
    const gs2025B = sets.find((set) => set.site === 'GS' && set.semester === '2025B');

    expect(gs2025B?.nights.start).toBe('2025-08-02');
    // Exclusive: the semester's last night is 2026-02-01, so the range ends the day after.
    expect(gs2025B?.nights.end).toBe('2026-02-02');
  });

  it('answers a real DateInterval for every schedule, never a null-sided one', async () => {
    // A schedule with no records has no nights to build a non-null DateInterval from.
    const data = await run('{ publishedSemesters { site semester nights { start end } } }');
    const sets = data.publishedSemesters as { nights: { start: string; end: string } }[];

    const isoDate = /^\d{4}-\d{2}-\d{2}$/;
    for (const set of sets) {
      expect(set.nights.start).toMatch(isoDate);
      expect(set.nights.end).toMatch(isoDate);
      expect(set.nights.start < set.nights.end).toBe(true);
    }
  });
});

/** A malformed interval must not answer [] like a well-formed query over an unrecorded span (I4). */
describe('a malformed interval is refused, not answered with an empty list', () => {
  it('names the offending argument on telescopeNights, whose range is dates', async () => {
    const message = await runExpectingError(
      '{ telescopeNights(site: GS, nights: { start: "2025-09-10", end: "2025-09-01" }) { observingNight } }',
    );

    expect(message).toContain('nights is reversed');
    expect(message).toContain('2025-09-10');
    expect(message).toContain('2025-09-01');
  });

  it('refuses one on instrumentAvailability, whose range is instants', async () => {
    const message = await runExpectingError(
      `{ instrumentAvailability(
           site: GS
           interval: { start: "2025-09-10T00:00:00Z", end: "2025-09-01T00:00:00Z" }
         ) { instrument } }`,
    );

    expect(message).toContain('interval is reversed');
  });

  // A table rather than five near-identical tests.
  const REVERSED = 'interval: { start: "2025-09-10T00:00:00Z", end: "2025-09-01T00:00:00Z" }';
  const OTHERS: readonly { query: string; selection: string }[] = [
    { query: 'instrumentComponentAvailability', selection: 'usage' },
    { query: 'telescopeAvailability', selection: 'availability' },
    { query: 'tooSupport', selection: 'tooSupport' },
    { query: 'telescopeMode', selection: 'mode' },
    { query: 'telescopeSubsystemAvailability', selection: 'subsystem' },
  ];

  for (const { query, selection } of OTHERS) {
    it(`refuses one on ${query}`, async () => {
      const message = await runExpectingError(`{ ${query}(site: GS, ${REVERSED}) { ${selection} } }`);

      expect(message).toContain('interval is reversed');
    });
  }

  it('states it in an error graphql-yoga will not mask', async () => {
    const result = await graphql({
      schema,
      source: `{ tooSupport(site: GS, ${REVERSED}) { tooSupport } }`,
    });
    const error = result.errors?.[0];

    expect(maskError(error, 'Unexpected error.', false)).toHaveProperty('message', error?.message);
  });

  // An unparseable bound parses to NaN, so every overlap comparison is false and the answer is [] again.
  it('refuses an unparseable bound, and says which one', async () => {
    const message = await runExpectingError(
      '{ tooSupport(site: GS, interval: { start: "garbage", end: "2025-09-10T00:00:00Z" }) { tooSupport } }',
    );

    expect(message).toContain('interval start is unparseable');
    expect(message).toContain('garbage');
  });
});

describe('telescopeNight', () => {
  const NIGHT = `
    query ($site: Site!, $night: Date!) {
      telescopeNight(site: $site, observingNight: $night) {
        observingNight
        dataAvailable
        interval { start end }
        instrumentAvailability {
          instrument
          publishedName
          usage
          ${LOCATION}
          interval { start end }
        }
        telescopeAvailability { availability port reason }
      }
    }`;

  it('rides the stored instruments alongside the mounted ones, placed not ported', async () => {
    // Stored instruments answer with a place instead of a port, which is what keeps them off the charts.
    const data = await run(NIGHT, { site: 'GS', night: '2025-11-20' });
    const night = data.telescopeNight as {
      instrumentAvailability: { instrument: string; location: BlockLocation }[];
    };
    const stored = night.instrumentAvailability
      .map((block) => block.location)
      .filter((location) => location.place !== 'PORT');

    expect(stored.length).toBeGreaterThan(0);
    for (const location of stored) {
      expect(['FLOOR', 'LAB', 'BASE', 'UNKNOWN']).toContain(location.place);
      expect(location.port).toBeNull();
    }
  });

  it('returns the instruments mounted on a night, with their ports', async () => {
    const data = await run(NIGHT, { site: 'GS', night: '2025-09-10' });
    const night = data.telescopeNight as Record<string, unknown>;
    const all = night.instrumentAvailability as { instrument: string; location: BlockLocation }[];
    // Ports only: a stored instrument is not what "mounted on a night" means.
    const mounted = all.filter((entry) => entry.location.place === 'PORT');

    expect(night.dataAvailable).toBe(true);
    expect(mounted.map((entry) => `${entry.instrument}@${String(entry.location.port)}`).sort()).toEqual([
      'CANOPUS@4',
      'F2@5',
      'GCAL@2',
      'GHOST@1',
      'GMOS@3',
    ]);
  });

  it('clips every record to the night, which is what makes partial nights work', async () => {
    const data = await run(NIGHT, { site: 'GS', night: '2025-09-10' });
    const night = data.telescopeNight as { interval: { start: string; end: string } } & Record<string, unknown>;

    for (const record of night.instrumentAvailability as { interval: { start: string; end: string } }[]) {
      expect(record.interval.start).toBe(night.interval.start);
      expect(record.interval.end).toBe(night.interval.end);
    }
  });

  it('reports the telescope closed during a shutdown', async () => {
    // The workbook opens on GS's August 2024 shutdown: evenings 1-15 closed.
    const data = await run(NIGHT, { site: 'GS', night: '2024-08-05' });
    const closures = (data.telescopeNight as Record<string, unknown>).telescopeAvailability as {
      availability: string;
      port: number | null;
      reason: string | null;
    }[];
    const siteWide = closures.find((closure) => closure.port === null);

    expect(siteWide?.availability).toBe('CLOSED');
    expect(siteWide?.reason).toContain('Shutdown');
  });

  it("serves the workbook's usability column as the block's usage", async () => {
    // 2024-08-23 is the only single-night usage change the workbook records.
    const data = await run(NIGHT, { site: 'GS', night: '2024-08-24' });
    const mounted = (data.telescopeNight as Record<string, unknown>).instrumentAvailability as {
      instrument: string;
      usage: string;
    }[];

    expect(mounted.find((entry) => entry.instrument === 'GMOS')?.usage).toBe('ENGINEERING');
  });

  it('says so plainly when a night has nothing recorded', async () => {
    const data = await run(NIGHT, { site: 'GS', night: '2030-01-01' });
    const night = data.telescopeNight as Record<string, unknown>;

    // Never an empty list that reads as "nothing is available".
    expect(night.dataAvailable).toBe(false);
    expect(night.instrumentAvailability).toEqual([]);
    expect(night.telescopeAvailability).toEqual([]);
  });
});

describe('telescopeNights - the scheduler contract', () => {
  const NIGHTS = `
    query ($site: Site!, $start: Date!, $end: Date!) {
      telescopeNights(site: $site, nights: { start: $start, end: $end }) {
        observingNight
        dataAvailable
        instrumentAvailability { instrument }
      }
    }`;

  it('returns one entry per night, start inclusive and end exclusive', async () => {
    const data = await run(NIGHTS, { site: 'GS', start: '2025-08-08', end: '2025-08-15' });
    const nights = data.telescopeNights as { observingNight: string }[];

    expect(nights).toHaveLength(7);
    expect(nights[0]?.observingNight).toBe('2025-08-08');
    expect(nights.at(-1)?.observingNight).toBe('2025-08-14');
  });

  it('keeps un-entered nights in the response rather than dropping them', async () => {
    const data = await run(NIGHTS, { site: 'GS', start: '2027-01-30', end: '2027-02-04' });
    const nights = data.telescopeNights as { dataAvailable: boolean }[];

    expect(nights).toHaveLength(5);
    expect(nights.some((night) => !night.dataAvailable)).toBe(true);
  });

  it('refuses a range beyond 400 nights, and says how many were asked for', async () => {
    const result = await graphql({
      schema,
      source: '{ telescopeNights(site: GS, nights: { start: "2025-01-01", end: "2027-01-01" }) { observingNight } }',
    });

    expect(result.errors?.[0]?.message).toContain('400 nights');
    expect(result.errors?.[0]?.message).toContain('730 requested');
  });

  it('states the bound in an error graphql-yoga will not mask', async () => {
    const result = await graphql({
      schema,
      source: '{ telescopeNights(site: GS, nights: { start: "2025-01-01", end: "2027-01-01" }) { observingNight } }',
    });
    const error = result.errors?.[0];

    // Run the real masking function: without it a scheduler on :4000 is told nothing about the limit.
    expect(maskError(error, 'Unexpected error.', false)).toHaveProperty('message', error?.message);
  });
});

describe('instrumentAvailability', () => {
  const RANGE = `
    query ($site: Site!, $start: Timestamp!, $end: Timestamp!, $clip: Boolean!) {
      instrumentAvailability(site: $site, interval: { start: $start, end: $end }, clip: $clip) {
        instrument
        ${LOCATION}
        interval { start end }
      }
    }`;

  it('states where each run is: the port for a mounting, UNKNOWN for an off-port run', async () => {
    // The 'Alopeke visitor run is usable with no port recorded.
    const data = await run(RANGE, {
      site: 'GN',
      start: '2026-09-24T00:00:00.000Z',
      end: '2026-09-30T00:00:00.000Z',
      clip: false,
    });
    const records = data.instrumentAvailability as {
      instrument: string;
      location: BlockLocation;
    }[];

    const alopeke = records.find((record) => record.instrument === 'ALOPEKE');
    expect(alopeke?.location).toEqual({ place: 'UNKNOWN', port: null });
    const mounted = records.find((record) => record.location.port === 1);
    expect(mounted?.location).toEqual({ place: 'PORT', port: 1 });
  });

  it('returns stored intervals by default, so a view can draw past its own edge', async () => {
    const data = await run(RANGE, {
      site: 'GS',
      start: '2025-09-01T00:00:00.000Z',
      end: '2025-09-08T00:00:00.000Z',
      clip: false,
    });
    const records = data.instrumentAvailability as { interval: { start: string } }[];

    expect(records.length).toBeGreaterThan(0);
    // GHOST has been mounted since August, so its unclipped interval starts before the window.
    expect(records.some((record) => record.interval.start < '2025-09-01')).toBe(true);
  });

  it('trims to the requested interval when asked', async () => {
    const data = await run(RANGE, {
      site: 'GS',
      start: '2025-09-01T00:00:00.000Z',
      end: '2025-09-08T00:00:00.000Z',
      clip: true,
    });

    // Compared as instants: two spellings of the same moment do not order lexically.
    for (const record of data.instrumentAvailability as { interval: { start: string; end: string } }[]) {
      expect(Date.parse(record.interval.start)).toBeGreaterThanOrEqual(Date.parse('2025-09-01T00:00:00Z'));
      expect(Date.parse(record.interval.end)).toBeLessThanOrEqual(Date.parse('2025-09-08T00:00:00Z'));
    }
  });

  const NAMED_RANGE = `
    query ($site: Site!, $start: Timestamp!, $end: Timestamp!) {
      instrumentAvailability(site: $site, interval: { start: $start, end: $end }, clip: false) {
        instrument
        publishedName
        ${LOCATION}
        note
        interval { start end }
      }
    }`;

  interface NamedRecord {
    instrument: string;
    publishedName: string;
    location: BlockLocation;
    note: string | null;
  }

  it('serves Zorro displacing GCAL on Port 2 for a visitor run', async () => {
    // GCAL holds Port 2 until the speckle imager's visitor run takes it over.
    const data = await run(NAMED_RANGE, {
      site: 'GS',
      start: '2024-09-17T00:00:00.000Z',
      end: '2024-09-19T00:00:00.000Z',
    });
    const portTwo = (data.instrumentAvailability as NamedRecord[]).filter((record) => record.location.port === 2);

    expect(portTwo.map((record) => `${record.instrument}:${record.publishedName}`)).toEqual(['CAL_ZORRO:Zorro']);
  });

  it('keeps a port with nothing mounted a gap, never an UNAVAILABLE record', async () => {
    // Evenings 2024-08-16..22: open telescope, empty Port 3. Nothing may be served there (I4).
    const data = await run(NAMED_RANGE, {
      site: 'GS',
      start: '2024-08-18T00:00:00.000Z',
      end: '2024-08-20T00:00:00.000Z',
    });

    expect((data.instrumentAvailability as NamedRecord[]).some((record) => record.location.port === 3)).toBe(false);
  });

  it('returns a whole semester in one response, unpaged', async () => {
    const data = await run(RANGE, {
      site: 'GS',
      start: '2025-08-02T00:00:00.000Z',
      end: '2026-02-01T00:00:00.000Z',
      clip: false,
    });

    // Five uninterrupted mountings, one per port, plus the stored instruments.
    const records = data.instrumentAvailability as { location: BlockLocation }[];
    expect(records.filter((record) => record.location.place === 'PORT')).toHaveLength(5);
  });

  it('pairs place and port on every record, which the schema does not enforce', async () => {
    // The port/place pairing is a promise the server keeps, not a shape the SDL holds; this checks it.
    const data = await run(RANGE, {
      site: 'GS',
      start: '2025-08-02T00:00:00.000Z',
      end: '2026-02-01T00:00:00.000Z',
      clip: false,
    });
    const records = data.instrumentAvailability as { location: BlockLocation }[];

    expect(records.length).toBeGreaterThan(5);
    for (const { location } of records) {
      expect(location.port !== null).toBe(location.place === 'PORT');
    }
  });
});

/** Components are live and never schedule-owned: top-level, unpaged, one search argument. */
describe('components', () => {
  const COMPONENTS = `
    query ($site: Site!, $instruments: [Instrument!], $types: [InstrumentComponentType!], $search: NonEmptyString) {
      components(site: $site, instruments: $instruments, componentTypes: $types, search: $search) {
        id
        instrument
        componentType
        code
        name
        barcode
        aliases
      }
    }`;

  it('lists a site catalog, identity only', async () => {
    const data = await run(COMPONENTS, { site: 'GS' });
    const components = data.components as { instrument: string }[];

    expect(components.length).toBeGreaterThan(20);
    expect(new Set(components.map((component) => component.instrument))).toEqual(
      new Set(['GMOS', 'F2', 'GHOST', 'CAL_ZORRO', 'GSAOI', 'CANOPUS', 'IQUEYE']),
    );
  });

  it('finds a piece by any published identity - name, code, barcode or alias', async () => {
    const byName = (await run(COMPONENTS, { site: 'GS', search: 'K-short' })).components as { code: string }[];
    const byCode = (await run(COMPONENTS, { site: 'GS', search: 'R400_G5325' })).components as { code: string }[];
    const byBarcode = (await run(COMPONENTS, { site: 'GS', search: '11002801' })).components as { code: string }[];
    const byAlias = (await run(COMPONENTS, { site: 'GS', search: 'the long mask' })).components as { code: string }[];

    expect(byName.map((component) => component.code)).toContain('K_SHORT');
    expect(byCode.map((component) => component.code)).toEqual(['R400_G5325']);
    expect(byBarcode.map((component) => component.code)).toEqual(['11002801']);
    expect(byAlias.map((component) => component.code)).toEqual(['11002802']);
  });

  it('filters by instrument and by type', async () => {
    const data = await run(COMPONENTS, { site: 'GS', instruments: ['F2'], types: ['FILTER'] });
    const components = data.components as { instrument: string; componentType: string }[];

    expect(components.length).toBeGreaterThan(0);
    for (const component of components) {
      expect(component).toMatchObject({ instrument: 'F2', componentType: 'FILTER' });
    }
  });
});

describe('telescopeSubsystemAvailability', () => {
  const SUBSYSTEMS = `
    query ($site: Site!, $interval: TimestampIntervalInput!, $subsystems: [TelescopeSubsystem!]) {
      telescopeSubsystemAvailability(site: $site, interval: $interval, subsystems: $subsystems) {
        subsystem
        usage
        powerSource
        interval { start end }
      }
    }`;
  const NOVEMBER = { start: '2025-11-01T00:00:00Z', end: '2025-11-08T00:00:00Z' };

  it('serves the workbook subsystems: the sensors, and the laser per site', async () => {
    const gs = await run(SUBSYSTEMS, { site: 'GS', interval: NOVEMBER });
    const records = gs.telescopeSubsystemAvailability as { subsystem: string; usage: string }[];

    expect(new Set(records.map((record) => record.subsystem))).toEqual(new Set(['PWFS1', 'PWFS2', 'LGS']));
    // Gemini South has no laser: "No" every night is a recorded fact, not a gap.
    expect(records.find((record) => record.subsystem === 'LGS')?.usage).toBe('UNAVAILABLE');

    const gn = await run(SUBSYSTEMS, { site: 'GN', interval: NOVEMBER });
    const north = gn.telescopeSubsystemAvailability as { subsystem: string; usage: string }[];
    expect(north.find((record) => record.subsystem === 'LGS')?.usage).toBe('SCIENCE');
  });

  it('filters by subsystem, for a consumer that only wants the laser', async () => {
    const data = await run(SUBSYSTEMS, { site: 'GN', interval: NOVEMBER, subsystems: ['LGS'] });
    const records = data.telescopeSubsystemAvailability as { subsystem: string }[];

    expect(records.length).toBeGreaterThan(0);
    expect(new Set(records.map((record) => record.subsystem))).toEqual(new Set(['LGS']));
  });

  it('rides the night projection, clipped like every other night fact', async () => {
    const data = await run(
      `query { telescopeNight(site: GS, observingNight: "2025-11-20") {
        subsystems { subsystem usage interval { start end } }
      } }`,
    );
    const night = data.telescopeNight as { subsystems: { interval: { start: string; end: string } }[] };

    expect(night.subsystems.length).toBeGreaterThan(0);
    expect(night.subsystems[0]?.interval).toEqual({ start: '2025-11-19T17:00:00Z', end: '2025-11-20T17:00:00Z' });
  });
});

describe('components - existence', () => {
  const EXISTENCE = `
    query ($site: Site!, $includeDeleted: Boolean!) {
      components(site: $site, search: "GS2024A", includeDeleted: $includeDeleted) {
        code
        existence
      }
    }`;

  it('keeps a retired piece out of the catalog unless asked for', async () => {
    const hidden = await run(EXISTENCE, { site: 'GS', includeDeleted: false });
    expect(hidden.components).toEqual([]);

    const shown = await run(EXISTENCE, { site: 'GS', includeDeleted: true });
    expect(shown.components).toEqual([{ code: '11009901', existence: 'DELETED' }]);
  });
});

describe('instrumentComponentAvailability', () => {
  const AVAILABILITY = `
    query ($site: Site!, $interval: TimestampIntervalInput!, $clip: Boolean!) {
      instrumentComponentAvailability(site: $site, interval: $interval, clip: $clip) {
        component { code }
        usage
        location
        interval { start end }
        note
      }
    }`;

  const OCTOBER = { start: '2025-10-01T00:00:00Z', end: '2025-11-01T00:00:00Z' };

  interface Block {
    component: { code: string };
    usage: string;
    location: string;
    interval: { start: string; end: string };
    note: string | null;
  }

  it('reports where each piece is: installed pieces and stored pieces together', async () => {
    const data = await run(AVAILABILITY, { site: 'GS', interval: OCTOBER, clip: false });
    const blocks = data.instrumentComponentAvailability as Block[];

    const places = new Set(blocks.map((block) => block.location));
    expect(places.has('INSTALLED')).toBe(true);
    expect(places.has('LAB')).toBe(true);
    expect(places.has('BASE')).toBe(true);
  });

  it('honours the clipping contract instrumentAvailability set (I6)', async () => {
    const clipped = (await run(AVAILABILITY, { site: 'GS', interval: OCTOBER, clip: true }))
      .instrumentComponentAvailability as Block[];

    for (const block of clipped) {
      expect(block.interval.start >= OCTOBER.start).toBe(true);
      expect(block.interval.end <= OCTOBER.end).toBe(true);
    }
  });

  it('returns stored intervals when unclipped, so a browser can phrase the whole span', async () => {
    const raw = (await run(AVAILABILITY, { site: 'GS', interval: OCTOBER, clip: false }))
      .instrumentComponentAvailability as Block[];

    // The R831 spare has sat in the lab since before October, so its record reaches outside the window.
    const spare = raw.find((block) => block.component.code === 'R831_G5322');
    expect(spare !== undefined && spare.interval.start < OCTOBER.start).toBe(true);
  });
});

describe('tooSupport and telescopeMode - the telescope-state blocks', () => {
  const RANGE = `
    query ($site: Site!, $interval: TimestampIntervalInput!, $clip: Boolean!) {
      tooSupport(site: $site, interval: $interval, clip: $clip) { tooSupport note interval { start end } }
      telescopeMode(site: $site, interval: $interval, clip: $clip) { mode note interval { start end } }
    }`;

  // The whole of GS 2024B; it ends before 2025A's first night, since abutting semesters share an instant.
  const SEMESTER = { start: '2024-08-01T00:00:00Z', end: '2025-02-01T00:00:00Z' };

  it('serves the workbook ToOs and Mode/Program columns as blocks', async () => {
    const data = await run(RANGE, { site: 'GS', interval: SEMESTER, clip: false });

    // The ToOs column is blank on every night; the import serves standard support as the assumption.
    expect(data.tooSupport as { tooSupport: string; note: string | null }[]).toMatchObject([
      { tooSupport: 'STANDARD', note: 'Assumed: the workbook does not record ToO support' },
    ]);
    // Queue, interrupted by the three Zorro visitor runs.
    expect((data.telescopeMode as { mode: string }[]).map((block) => block.mode)).toEqual([
      'QUEUE',
      'PRIORITY_VISITOR',
      'QUEUE',
      'PRIORITY_VISITOR',
      'QUEUE',
      'PRIORITY_VISITOR',
      'QUEUE',
    ]);
  });

  it('names the visitor a Visitor mode span is for', async () => {
    const data = await run(RANGE, { site: 'GS', interval: SEMESTER, clip: false });
    const visitor = (data.telescopeMode as { mode: string; note: string | null }[]).find(
      (block) => block.mode === 'PRIORITY_VISITOR',
    );

    expect(visitor?.note).toBe('Zorro');
  });

  it('honours the clipping contract every other range query set', async () => {
    const window = { start: '2024-10-01T00:00:00Z', end: '2024-10-02T00:00:00Z' };
    const data = await run(RANGE, { site: 'GS', interval: window, clip: true });
    const [mode] = data.telescopeMode as { interval: { start: string; end: string } }[];

    expect(mode?.interval).toEqual(window);
  });

  it('leaves the mode unrecorded during a shutdown, while the assumed ToO support spans it', async () => {
    // During the shutdown the Mode row has a gap; the assumed Standard ToO support survives it.
    const data = await run(
      `query ($site: Site!, $night: Date!) {
        telescopeNight(site: $site, observingNight: $night) {
          telescopeAvailability { availability }
          tooSupport { tooSupport }
          telescopeMode { mode }
        }
      }`,
      { site: 'GS', night: '2024-08-05' },
    );
    const night = data.telescopeNight as {
      telescopeAvailability: { availability: string }[];
      tooSupport: { tooSupport: string }[];
      telescopeMode: unknown[];
    };

    expect(night.telescopeAvailability.map((block) => block.availability)).toEqual(['CLOSED']);
    expect(night.tooSupport.map((block) => block.tooSupport)).toEqual(['STANDARD']);
    expect(night.telescopeMode).toEqual([]);
  });

  it('clips both into the night projection', async () => {
    // A GN night inside the August 2026 MAROON-X visitor run.
    const data = await run(
      `query ($site: Site!, $night: Date!) {
        telescopeNight(site: $site, observingNight: $night) {
          interval { start end }
          tooSupport { tooSupport interval { start end } }
          telescopeMode { mode note interval { start end } }
        }
      }`,
      { site: 'GN', night: '2026-08-27' },
    );
    const night = data.telescopeNight as {
      interval: { start: string; end: string };
      tooSupport: { tooSupport: string; interval: { start: string; end: string } }[];
      telescopeMode: { mode: string; note: string | null; interval: { start: string; end: string } }[];
    };

    expect(night.tooSupport.map((block) => block.tooSupport)).toEqual(['STANDARD']);
    expect(night.telescopeMode).toHaveLength(1);
    expect(night.telescopeMode[0]).toMatchObject({ mode: 'PRIORITY_VISITOR', note: 'MAROON-X' });
    expect(night.telescopeMode[0]?.interval).toEqual(night.interval);
  });
});

describe('telescopeNight.components - the scheduler contract', () => {
  const NIGHT = `
    query ($site: Site!, $night: Date!) {
      telescopeNight(site: $site, observingNight: $night) {
        dataAvailable
        components {
          component { code }
          location
          interval { start end }
        }
      }
    }`;

  it('clips component records to the night, like every other night fact', async () => {
    const data = await run(NIGHT, { site: 'GS', night: '2025-10-15' });
    const night = data.telescopeNight as {
      components: { location: string; interval: { start: string; end: string } }[];
    };

    expect(night.components.length).toBeGreaterThan(0);
    const [first] = night.components;
    const nightSpan = Date.parse(first!.interval.end) - Date.parse(first!.interval.start);
    expect(nightSpan).toBeLessThanOrEqual(25 * 3_600_000);
  });

  it('never lets synthetic components make an unrecorded night look recorded', async () => {
    // The fake layer is derived from the schedules, so a night outside every schedule stays false.
    const data = await run(NIGHT, { site: 'GS', night: '2024-01-15' });
    const night = data.telescopeNight as { dataAvailable: boolean; components: unknown[] };

    expect(night.dataAvailable).toBe(false);
    expect(night.components).toEqual([]);
  });
});
