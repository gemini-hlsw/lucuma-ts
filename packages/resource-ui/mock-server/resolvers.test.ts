/**
 * The resolvers, executed against the real executable schema and the real
 * imported schedules.
 *
 * Run through `graphql()` rather than through Apollo, because SchemaLink skips
 * validation - a page test alone would not catch an invalid selection or a
 * wrong derivation.
 */
import { graphql } from 'graphql';
import { maskError } from 'graphql-yoga';
import { describe, expect, it } from 'vitest';

import sdl from './schema.graphql?raw';
import { buildMockSchema } from './schema.ts';

const { schema } = buildMockSchema(sdl);

const run = async (source: string, variableValues?: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const result = await graphql({ schema, source, variableValues });
  expect(result.errors).toBeUndefined();
  return result.data ?? {};
};

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

    // OdbSchema.graphql: "ISO-8601 representation in format '2011-12-03T10:15:30Z'".
    // toISOString() and the imported fixtures both carry a ".000", which would put
    // the mock's wire format at odds with the service it stands in for.
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
    // Chile springs forward inside the night labelled 2026-09-06, so 14:00 to
    // 14:00 local is 23 hours. Deriving duration from the interval is what keeps
    // that honest - and is the same reason blocks carry intervals, not dates.
    const { duration } = (await intervalOn('GS', '2026-09-06')) as unknown as {
      duration: { hours: number; iso: string };
    };

    expect(duration.hours).toBe(23);
    expect(duration.iso).toBe('PT23H');
  });
});

describe('publishedSemesters', () => {
  it('offers every semester the workbook holds, for the site + semester picker', async () => {
    const data = await run('{ publishedSemesters { site semester title version firstNight lastNight } }');
    const sets = data.publishedSemesters as { site: string; semester: string }[];

    // The operations workbook: GS runs 2024B through 2026A, GN through 2026B
    // (its single 2027A evening is trimmed as an export artifact).
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
    const data = await run('{ publishedSemesters { site semester firstNight lastNight } }');
    const sets = data.publishedSemesters as {
      site: string;
      semester: string;
      firstNight: string;
      lastNight: string;
    }[];
    const gs2025B = sets.find((set) => set.site === 'GS' && set.semester === '2025B');

    expect(gs2025B?.firstNight).toBe('2025-08-02');
    expect(gs2025B?.lastNight).toBe('2026-02-01');
  });
});

describe('telescopeNight', () => {
  const NIGHT = `
    query ($site: Site!, $night: Date!) {
      telescopeNight(site: $site, observingNight: $night) {
        observingNight
        dataAvailable
        interval { start end }
        instrumentAvailability { instrument publishedName usage location { type port } interval { start end } }
        telescopeAvailability { availability port reason }
      }
    }`;

  it('rides the stored instruments alongside the mounted ones, placed not ported', async () => {
    // The synthetic stored layer (storedInstruments.ts): instruments GPP knows
    // about that the workbook never schedules. They answer in the same shape
    // with a place instead of a port, which is what keeps them off the charts.
    const data = await run(NIGHT, { site: 'GS', night: '2025-11-20' });
    const night = data.telescopeNight as {
      instrumentAvailability: { instrument: string; location: { type: string; port: number | null } }[];
    };
    const stored = night.instrumentAvailability.filter((block) => block.location.type !== 'PORT');

    expect(stored.length).toBeGreaterThan(0);
    for (const block of stored) {
      expect(block.location.port).toBeNull();
      expect(['FLOOR', 'LAB', 'BASE', 'UNKNOWN']).toContain(block.location.type);
    }
  });

  it('returns the instruments mounted on a night, with their ports', async () => {
    const data = await run(NIGHT, { site: 'GS', night: '2025-09-10' });
    const night = data.telescopeNight as Record<string, unknown>;
    const all = night.instrumentAvailability as { instrument: string; location: { type: string; port: number } }[];
    // Ports only: the stored instruments ride the same list (test above) and
    // are not what "mounted on a night" means.
    const mounted = all.filter((entry) => entry.location.type === 'PORT');

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
    // The evening of 2024-08-23: GMOS is mounted but its column says
    // Engineering, the one night the workbook records a non-science usage.
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

    // The dev server puts this schema behind yoga, which replaces anything that is
    // not a GraphQLError with "Unexpected error." The assertion above passes either
    // way, so run the real masking function: without it, a scheduler hitting :4000
    // is told nothing about the limit it has to stay under.
    expect(maskError(error, 'Unexpected error.', false)).toHaveProperty('message', error?.message);
  });
});

describe('instrumentAvailability', () => {
  const RANGE = `
    query ($site: Site!, $start: Timestamp!, $end: Timestamp!, $clip: Boolean!) {
      instrumentAvailability(site: $site, interval: { start: $start, end: $end }, clip: $clip) {
        instrument
        location { type port }
        interval { start end }
      }
    }`;

  it('states where each run is: the port for a mounting, UNKNOWN for an off-port run', async () => {
    // The `Alopeke visitor run of late September 2026 is usable with no port
    // recorded - the workbook does not say where it physically is.
    const data = await run(RANGE, {
      site: 'GN',
      start: '2026-09-24T00:00:00.000Z',
      end: '2026-09-30T00:00:00.000Z',
      clip: false,
    });
    const records = data.instrumentAvailability as {
      instrument: string;
      location: { type: string; port: number | null };
    }[];

    const alopeke = records.find((record) => record.instrument === 'ALOPEKE');
    expect(alopeke?.location).toEqual({ type: 'UNKNOWN', port: null });
    const mounted = records.find((record) => record.location.port === 1);
    expect(mounted?.location).toEqual({ type: 'PORT', port: 1 });
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
    // GHOST has been mounted since August, so its stored interval starts before
    // the September window that asked for it.
    expect(records.some((record) => record.interval.start < '2025-09-01')).toBe(true);
  });

  it('trims to the requested interval when asked', async () => {
    const data = await run(RANGE, {
      site: 'GS',
      start: '2025-09-01T00:00:00.000Z',
      end: '2025-09-08T00:00:00.000Z',
      clip: true,
    });

    // Compared as instants, not as strings: two spellings of the same moment
    // ("…00Z" and "…00.000Z") do not order lexically.
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
        location { port }
        note
        interval { start end }
      }
    }`;

  interface NamedRecord {
    instrument: string;
    publishedName: string;
    location: { port: number | null };
    note: string | null;
  }

  it('serves Zorro displacing GCAL on Port 2 for a visitor run', async () => {
    // The workbook splits what the sheets folded into "Cal/ZORRO": GCAL holds
    // Port 2 until the speckle imager's visitor run takes it over.
    const data = await run(NAMED_RANGE, {
      site: 'GS',
      start: '2024-09-17T00:00:00.000Z',
      end: '2024-09-19T00:00:00.000Z',
    });
    const portTwo = (data.instrumentAvailability as NamedRecord[]).filter((record) => record.location.port === 2);

    expect(portTwo.map((record) => `${record.instrument}:${record.publishedName}`)).toEqual(['CAL_ZORRO:Zorro']);
  });

  it('keeps a port with nothing mounted a gap, never an UNAVAILABLE record', async () => {
    // Evenings 2024-08-16..22: the telescope is open but Port 3 is empty -
    // GMOS's column says Not Available, and no port names it. Nothing may be
    // served there (I4); the mounting resumes on the 23rd.
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

    // GS 2025B is five uninterrupted mountings, one per port - plus the
    // stored instruments, which are not the semester's schedule.
    const records = data.instrumentAvailability as { location: { type: string } }[];
    expect(records.filter((record) => record.location.type === 'PORT')).toHaveLength(5);
  });
});

/**
 * The component surface - the mock's improved take on the doc's endpoints:
 * top-level (components are live, never schedule-owned), unpaged, one search
 * argument, and a `location` on the block so "where is it" is answerable.
 */
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

    // The R831 spare has sat in the lab since the working set began - well
    // before October - so its unclipped record must reach outside the window.
    const spare = raw.find((block) => block.component.code === 'R831_G5322');
    expect(spare !== undefined && spare.interval.start < OCTOBER.start).toBe(true);
  });
});

describe('tooSupport and telescopeMode - the telescope-state blocks', () => {
  const RANGE = `
    query ($site: Site!, $interval: TimestampIntervalInput!, $clip: Boolean!) {
      tooSupport(site: $site, interval: $interval, clip: $clip) { id tooSupport note interval { start end } }
      telescopeMode(site: $site, interval: $interval, clip: $clip) { id mode note interval { start end } }
    }`;

  // The whole of GS 2024B, the workbook's first semester.
  // Ends before 2025A's first night begins - abutting semesters share an instant.
  const SEMESTER = { start: '2024-08-01T00:00:00Z', end: '2025-02-01T00:00:00Z' };

  it('serves the workbook ToOs and Mode/Program columns as blocks', async () => {
    const data = await run(RANGE, { site: 'GS', interval: SEMESTER, clip: false });

    // The ToOs column is blank on every night of the export; the demo serves
    // the observatory's default, standard support, wearing the assumption.
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
    // GS's August 2024 shutdown: the telescope is not being operated in any
    // mode, so the Mode row has a gap. The assumed Standard ToO support is a
    // semester-wide default and survives the closure.
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
    // I4 at one remove: the fake layer is derived from the schedules, so it must
    // not decide dataAvailable - a night outside every schedule stays false.
    const data = await run(NIGHT, { site: 'GS', night: '2024-01-15' });
    const night = data.telescopeNight as { dataAvailable: boolean; components: unknown[] };

    expect(night.dataAvailable).toBe(false);
    expect(night.components).toEqual([]);
  });
});
