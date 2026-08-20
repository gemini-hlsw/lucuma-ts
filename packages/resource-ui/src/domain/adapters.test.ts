/**
 * The adapters, at the one place they do more than rename a field.
 *
 * `InstrumentLocation` states `place` and `port` separately and promises they
 * agree (`mock-server/schema.graphql`), so the wire can express a pairing the
 * domain's `Mounting` cannot hold. `toMountings` is where that promise is
 * checked, and these are its three outcomes.
 */
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

import { toMountings } from './adapters';

type Block = Parameters<typeof toMountings>[0][number];

/**
 * `publishedName` is a parameter because the dev warning is deduplicated on it
 * in a module-level set that nothing clears (`adapters.ts` says why). A test
 * asserting the warning must therefore use a name no earlier test has spent, or
 * it sees silence for a reason that has nothing to do with what it is testing.
 */
const block = (location: Block['location'], publishedName = 'GMOS-S'): Block => ({
  __typename: 'InstrumentAvailabilityBlock',
  instrument: 'GMOS',
  publishedName,
  usage: 'SCIENCE',
  note: null,
  interval: { __typename: 'TimestampInterval', start: '2026-08-09T18:00:00Z', end: '2026-08-10T18:00:00Z' },
  location,
});

describe(toMountings.name, () => {
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
    // The contradiction the schema can express and the domain cannot hold. It
    // must not throw - one bad record would empty a night's chart - and it must
    // not pass silently, because "Not on a port" on a scheduled night is
    // indistinguishable from a legitimate off-port run.
    const [mounting] = toMountings([block({ __typename: 'InstrumentLocation', place: 'PORT', port: null })]);

    expect(mounting).toMatchObject({ port: null, place: 'UNKNOWN' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('GMOS-S');
  });

  it('says it once per instrument, however many of its records are wrong', () => {
    // A degraded server answering a semester sends hundreds of these. One line
    // per broken instrument is a warning; one per record buries the console the
    // warning is meant to be read in.
    const wrong = { __typename: 'InstrumentLocation', place: 'PORT', port: null } as const;
    const mountings = toMountings([block(wrong, 'GNIRS'), block(wrong, 'GNIRS'), block(wrong, 'NIFS')]);

    expect(mountings.map((mounting) => mounting.place)).toEqual(['UNKNOWN', 'UNKNOWN', 'UNKNOWN']);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(String(warn.mock.calls[0]?.[0])).toContain('GNIRS');
    expect(String(warn.mock.calls[1]?.[0])).toContain('NIFS');
  });
});
