import { describe, expect, it } from 'vitest';

import { buildWorkbookSchedules, semesterOfEvening, type WorkbookRow } from './workbook.ts';

const addDays = (isoDate: string, days: number): string => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** A quiet GS night: everything mounted, open, queue, ToOs unrecorded. */
const row = (eveningDate: string, over: Partial<WorkbookRow> = {}): WorkbookRow => ({
  eveningDate,
  telescope: 'Open',
  modeProgram: 'Queue',
  lgs: 'No',
  toos: '',
  ports: ['GHOST', 'GCAL', 'GMOS-S', 'Canopus', 'Flamingos2'],
  statuses: { 'GMOS-S': 'Science', GHOST: 'Science', Canopus: 'Science', Flamingos2: 'Science' },
  ...over,
});

/** Consecutive rows from `first`, one per evening. */
const nights = (first: string, count: number, over: (evening: string) => Partial<WorkbookRow> = () => ({})) =>
  Array.from({ length: count }, (_, index) => {
    const evening = addDays(first, index);
    return row(evening, over(evening));
  });

const build = (rows: readonly WorkbookRow[]) => buildWorkbookSchedules([{ site: 'GS', rows }]);

describe('semesterOfEvening', () => {
  it('files February through July as A and August through January as B', () => {
    expect(semesterOfEvening('2025-02-01')).toBe('2025A');
    expect(semesterOfEvening('2025-07-31')).toBe('2025A');
    expect(semesterOfEvening('2025-08-01')).toBe('2025B');
    expect(semesterOfEvening('2025-12-31')).toBe('2025B');
    // January belongs to the previous year's B - the semester that began in August.
    expect(semesterOfEvening('2026-01-15')).toBe('2025B');
  });
});

describe('the subsystem import', () => {
  it('records the wavefront sensors nightly, splitting where the value changes', () => {
    const schedules = build(
      nights('2025-08-01', 3, (evening) => ({
        statuses: { ...row('x').statuses, PWFS1: evening === '2025-08-02' ? 'Not Available' : 'Science' },
      })),
    );
    const pwfs1 = schedules[0]?.subsystems?.filter((record) => record.subsystem === 'PWFS1') ?? [];

    expect(pwfs1.map((record) => record.usage)).toEqual(['SCIENCE', 'UNAVAILABLE', 'SCIENCE']);
  });

  it('reads the LGS column as the laser being available or not - both recorded facts', () => {
    const yes = build(nights('2025-08-01', 2, () => ({ lgs: 'Yes' })));
    const no = build(nights('2025-08-01', 2, () => ({ lgs: 'No' })));

    expect(yes[0]?.subsystems?.find((record) => record.subsystem === 'LGS')?.usage).toBe('SCIENCE');
    expect(no[0]?.subsystems?.find((record) => record.subsystem === 'LGS')?.usage).toBe('UNAVAILABLE');
  });
});

describe('the off-port usability import', () => {
  it('serves a usable instrument no port carries as a mounting with no port, on its own row', () => {
    // Zorro usable but the port column prints nothing for it - the visitor
    // between mounts. The workbook does not say where it physically is.
    const schedules = build(nights('2025-08-01', 2, () => ({ statuses: { Zorro: 'Science' } })));
    const zorro = schedules[0]?.blocks.find((block) => block.publishedName === 'Zorro');

    expect(zorro).toMatchObject({ kind: 'MOUNTED', instrument: 'CAL_ZORRO', rowLabel: 'Zorro', port: null });
    expect(zorro?.usage).toBeUndefined();
    expect(schedules[0]?.rowLabels).toEqual(['Port 1', 'Port 2', 'Port 3', 'Port 4', 'Port 5', 'Zorro']);
  });

  it('leaves a Not Available column as the gap it is - absence is not a record', () => {
    // Every unmounted instrument is marked Not Available by default; importing
    // those would invent an UNAVAILABLE row for every instrument all semester.
    const schedules = build(nights('2025-08-01', 2, () => ({ statuses: { Zorro: 'Not Available' } })));

    expect(schedules[0]?.blocks.find((block) => block.publishedName === 'Zorro')).toBeUndefined();
    expect(schedules[0]?.rowLabels).toEqual(['Port 1', 'Port 2', 'Port 3', 'Port 4', 'Port 5']);
  });

  it('does not double a mounted instrument whose usability column also says Science', () => {
    // GHOST rides Port 1 in the fixture; its Science status is the port
    // block's usage, never a second off-port row.
    const schedules = build(nights('2025-08-01', 2));

    expect(schedules[0]?.blocks.filter((block) => block.instrument === 'GHOST')).toHaveLength(1);
    expect(schedules[0]?.rowLabels).toHaveLength(5);
  });
});

describe('buildWorkbookSchedules', () => {
  it('splits the rows into per-semester schedules with the workbook as version', () => {
    const schedules = build([...nights('2025-07-30', 2), ...nights('2025-08-01', 2)]);

    expect(schedules.map((schedule) => schedule.semester)).toEqual(['2025A', '2025B']);
    expect(schedules[0]?.version).toBe('telescope_schedules.xlsx');
    expect(schedules[0]?.rowLabels).toEqual(['Port 1', 'Port 2', 'Port 3', 'Port 4', 'Port 5']);
  });

  it('folds a run of equal nights into one block labelled by observing nights', () => {
    const schedules = build(nights('2025-08-01', 3));
    const ghost = schedules[0]?.blocks.find((block) => block.publishedName === 'GHOST');

    // Evenings 1-3 August are the nights labelled 2-4 August.
    expect(ghost).toMatchObject({
      kind: 'MOUNTED',
      instrument: 'GHOST',
      rowLabel: 'Port 1',
      port: 1,
      firstObservingNight: '2025-08-02',
      lastObservingNight: '2025-08-04',
    });
  });

  it('starts a new block after a gap, never one block silently spanning it', () => {
    // GHOST leaves both the port and the usability column on the middle night
    // - truly absent, or it would honestly become an off-port run instead.
    const schedules = build(
      nights('2025-08-01', 3, (evening) =>
        evening === '2025-08-02'
          ? {
              ports: [null, 'GCAL', 'GMOS-S', 'Canopus', 'Flamingos2'],
              statuses: { 'GMOS-S': 'Science', Canopus: 'Science', Flamingos2: 'Science' },
            }
          : {},
      ),
    );
    const ghosts = schedules[0]?.blocks.filter((block) => block.publishedName === 'GHOST') ?? [];

    expect(ghosts).toHaveLength(2);
    expect(ghosts.map((block) => block.firstSheetDate)).toEqual(['2025-08-01', '2025-08-03']);
  });

  it("splits a block where the instrument's usability changes, carrying the usage", () => {
    const schedules = build(
      nights('2025-08-01', 3, (evening) =>
        evening === '2025-08-02' ? { statuses: { ...row('x').statuses, 'GMOS-S': 'Engineering' } } : {},
      ),
    );
    const gmos = schedules[0]?.blocks.filter((block) => block.publishedName === 'GMOS-S') ?? [];

    expect(gmos.map((block) => block.usage ?? 'SCIENCE')).toEqual(['SCIENCE', 'ENGINEERING', 'SCIENCE']);
  });

  it('keeps an unrecognised port name as UNKNOWN, with a warning to resolve it', () => {
    const schedules = build(
      nights('2025-08-01', 1, () => ({ ports: ['Mystery Cam', 'GCAL', 'GMOS-S', 'Canopus', 'Flamingos2'] })),
    );

    expect(schedules[0]?.blocks.find((block) => block.publishedName === 'Mystery Cam')?.kind).toBe('UNKNOWN');
    expect(schedules[0]?.warnings.some((warning) => warning.includes('Mystery Cam'))).toBe(true);
  });

  it('turns Closed/Shutdown nights into a closure and leaves the mode unrecorded', () => {
    const closed = { telescope: 'Closed', modeProgram: 'Shutdown', ports: [null, null, null, null, null] as const };
    const schedules = build(nights('2025-08-01', 4, (evening) => (evening <= '2025-08-02' ? { ...closed } : {})));
    const schedule = schedules[0];

    // Both availabilities are records: the shutdown, then the reopening.
    expect(schedule?.closures.map((run) => run.availability)).toEqual(['CLOSED', 'OPEN']);
    expect(schedule?.closures[0]).toMatchObject({ port: null, reason: 'Shutdown', firstObservingNight: '2025-08-02' });
    // The mode gap: QUEUE starts when operations resume.
    expect(schedule?.modes?.map((mode) => mode.mode)).toEqual(['QUEUE']);
  });

  it('records Open nights as availability records, not gaps - the sheet states them', () => {
    const schedules = build(nights('2025-08-01', 3));

    expect(schedules[0]?.closures).toHaveLength(1);
    expect(schedules[0]?.closures[0]).toMatchObject({ availability: 'OPEN', port: null, reason: null });
  });

  it('gives a night closed under an operating mode no reason, never "Queue"', () => {
    const schedules = build(
      nights('2025-08-01', 2, (evening) =>
        evening === '2025-08-01' ? { telescope: 'Closed', ports: [null, null, null, null, null] } : {},
      ),
    );

    expect(schedules[0]?.closures[0]?.reason).toBeNull();
  });

  it('reads a Visitor mode as PRIORITY_VISITOR, naming the visitor', () => {
    const schedules = build(
      nights('2025-08-01', 3, (evening) => (evening === '2025-08-02' ? { modeProgram: 'Visitor: Zorro' } : {})),
    );

    expect(schedules[0]?.modes?.map((mode) => `${mode.mode}:${mode.note ?? ''}`)).toEqual([
      'QUEUE:',
      'PRIORITY_VISITOR:Zorro',
      'QUEUE:',
    ]);
  });

  it('serves a blank ToOs column as the assumed Standard default, a written value as a fact', () => {
    // The current export leaves ToOs blank on every night, and the
    // observatory's default is standard ToO support - so blank serves as
    // STANDARD, wearing the assumption on the record. A written level is a
    // recorded fact and carries no note.
    const blank = build(nights('2025-08-01', 2));
    const written = build(nights('2025-08-01', 2, () => ({ toos: 'None' })));

    expect(blank[0]?.tooSupport).toHaveLength(1);
    expect(blank[0]?.tooSupport?.[0]).toMatchObject({
      tooSupport: 'STANDARD',
      note: 'Assumed: the workbook does not record ToO support',
    });
    expect(written[0]?.tooSupport?.[0]).toMatchObject({ tooSupport: 'NONE', note: null });
  });

  it('trims a trailing one-night semester as an export artifact, with a warning', () => {
    const schedules = build([...nights('2026-07-30', 2), ...nights('2026-08-01', 1)]);

    expect(schedules.map((schedule) => schedule.semester)).toEqual(['2026A']);
    expect(schedules.at(-1)?.warnings.some((warning) => warning.includes('trimmed'))).toBe(true);
  });
});
