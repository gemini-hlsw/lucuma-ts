/**
 * The operations workbook -> per-semester schedules.
 *
 * The workbook (`fixtures/telescope_schedules.xlsx`) is the operations team's
 * own record and the **only** source Resource populates from: one sheet per
 * site, one row per night, with the telescope state, the operating mode, the
 * ToO level, what each port carries, and each instrument's usability. This
 * module is pure - `importWorkbook.ts` does the file reading.
 *
 * ## How a row is read
 *
 * `Local Date` is the **evening** a night begins (`NightLabelling` in
 * blocks.ts derives why), so the night it describes is labelled by the next
 * day. A run of equal rows becomes one block with a real `[start, end)`
 * interval, and the semester split follows the evenings: February through July
 * is A, August through January is B.
 *
 * ## What is deliberately not imported
 *
 * - **Off-port usability.** Only what a port column mounts is served; an
 *   instrument marked "Science" with no port recorded (GN's later `Alopeke
 *   visitor runs) is surfaced as a warning, not a block - the schema has no
 *   row for an unmounted-but-usable instrument yet.
 * - **Wavefront-sensor columns** (PWFS1, PWFS2, the OIWFS columns) and the
 *   constant **LGS** column: no schema home. Warned once each.
 * - A **trailing one-night semester** (GN's export runs a single evening into
 *   2027A): trimmed as an export artifact, with a warning.
 */
import { observingNightInterval } from '../time.ts';
import type {
  ImportedBlock,
  ImportedClosure,
  ImportedSchedule,
  ImportedTelescopeMode,
  ImportedTooSupport,
  ImportSite,
  TelescopeModeType,
  TooSupportLevel,
} from './blocks.ts';
import { instrumentOf } from './instruments.ts';

/** One workbook row, already reduced to plain values by the file reader. */
export interface WorkbookRow {
  /** ISO date of the evening the night begins - the sheet's "Local Date". */
  readonly eveningDate: string;
  readonly telescope: string;
  readonly modeProgram: string;
  readonly lgs: string;
  readonly toos: string;
  /** The five port columns in order; null where the cell is empty or "None". */
  readonly ports: readonly (string | null)[];
  /** Every other column, header -> value, for the usability lookups. */
  readonly statuses: Readonly<Record<string, string>>;
}

export interface SiteRows {
  readonly site: ImportSite;
  readonly rows: readonly WorkbookRow[];
}

const SITE_NAME = { GN: 'North', GS: 'South' } as const;
export const WORKBOOK_VERSION = 'telescope_schedules.xlsx';
const ROW_LABELS = ['Port 1', 'Port 2', 'Port 3', 'Port 4', 'Port 5'] as const;

const addDays = (isoDate: string, days: number): string => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** The semester an evening belongs to: Feb-Jul is A, Aug-Jan is B. */
export const semesterOfEvening = (isoDate: string): string => {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  if (month === 1) {
    return `${String(year - 1)}B`;
  }
  return month <= 7 ? `${String(year)}A` : `${String(year)}B`;
};

const USAGE = {
  Science: 'SCIENCE',
  Engineering: 'ENGINEERING',
  'Not Available': 'UNAVAILABLE',
} as const;

const TOO = {
  None: 'NONE',
  Standard: 'STANDARD',
  Interrupt: 'INTERRUPT',
  Rapid: 'RAPID',
} as const;

/**
 * `Mode/Program` -> the mode enum. "Shutdown" is deliberately absent: a
 * shutdown night is a closure record, and its mode stays unrecorded - the
 * telescope is not being operated in any mode.
 */
const modeOf = (value: string): { mode: TelescopeModeType; note: string | null } | null => {
  if (value === 'Queue') {
    return { mode: 'QUEUE', note: null };
  }
  if (value.startsWith('Visitor')) {
    return { mode: 'PRIORITY_VISITOR', note: value.split(':')[1]?.trim() ?? null };
  }
  if (value === 'Engineering') {
    return { mode: 'ENGINEERING', note: null };
  }
  if (value === 'Commissioning') {
    return { mode: 'COMMISSIONING', note: null };
  }
  if (value.startsWith('Classical')) {
    return { mode: 'CLASSICAL', note: value.split(':')[1]?.trim() ?? null };
  }
  return null;
};

/**
 * Consecutive rows sharing a key, folded to [first, last] evening spans.
 *
 * A row with a null key ends the current run: the same instrument returning
 * after a gap is a new block, never one block silently spanning the gap. A
 * missing calendar date ends it too, for the same reason.
 */
const runsBy = <T>(
  rows: readonly WorkbookRow[],
  keyOf: (row: WorkbookRow) => T | null,
  sameKey: (a: T, b: T) => boolean,
): readonly { readonly key: T; readonly first: string; readonly last: string }[] => {
  const runs: { key: T; first: string; last: string }[] = [];
  let current: { key: T; first: string; last: string } | null = null;
  for (const row of rows) {
    const key = keyOf(row);
    if (key === null) {
      current = null;
      continue;
    }
    if (current !== null && sameKey(current.key, key) && addDays(current.last, 1) === row.eveningDate) {
      current.last = row.eveningDate;
    } else {
      current = { key, first: row.eveningDate, last: row.eveningDate };
      runs.push(current);
    }
  }
  return runs;
};

/** The evening span as the interval fields every record carries. */
const spanFields = (site: ImportSite, first: string, last: string) => {
  const firstNight = addDays(first, 1);
  const lastNight = addDays(last, 1);
  return {
    firstSheetDate: first,
    lastSheetDate: last,
    firstObservingNight: firstNight,
    lastObservingNight: lastNight,
    start: observingNightInterval(site, firstNight).start,
    end: observingNightInterval(site, lastNight).end,
  };
};

const buildSemester = (
  site: ImportSite,
  semester: string,
  rows: readonly WorkbookRow[],
  warnings: string[],
): ImportedSchedule => {
  const blocks: ImportedBlock[] = [];

  for (const [index, rowLabel] of ROW_LABELS.entries()) {
    interface PortKey {
      readonly name: string;
      readonly usage: 'SCIENCE' | 'ENGINEERING' | 'UNAVAILABLE' | undefined;
    }
    const runs = runsBy<PortKey>(
      rows,
      (row) => {
        const name = row.ports[index] ?? null;
        if (name === null) {
          return null;
        }
        const status = row.statuses[name];
        return { name, usage: status === undefined ? undefined : (USAGE[status as keyof typeof USAGE] ?? undefined) };
      },
      (a, b) => a.name === b.name && a.usage === b.usage,
    );

    for (const run of runs) {
      const instrument = instrumentOf(run.key.name);
      if (instrument === null) {
        warnings.push(
          `${site} ${semester}: unrecognised instrument "${run.key.name}" on ${rowLabel} - kept as UNKNOWN.`,
        );
      }
      blocks.push({
        kind: instrument === null ? 'UNKNOWN' : 'MOUNTED',
        site,
        rowLabel,
        port: index + 1,
        instrument,
        publishedName: run.key.name,
        ...spanFields(site, run.first, run.last),
        note: null,
        background: '',
        ...(run.key.usage === undefined || run.key.usage === 'SCIENCE' ? {} : { usage: run.key.usage }),
      });
    }
  }

  // The Telescope column records "Open" as explicitly as "Closed", so both
  // become availability records - the open nights are facts, not gaps. The
  // reason is the Mode/Program text when it names the closure ("Shutdown");
  // a night closed while the mode still says "Queue" - weather, most likely -
  // has no stated reason, and "Queue" must not become one.
  for (const value of new Set(rows.map((row) => row.telescope))) {
    if (value !== 'Open' && value !== 'Closed' && value !== '') {
      warnings.push(`${site} ${semester}: unrecognised Telescope value "${value}" - not imported.`);
    }
  }
  interface TelescopeKey {
    readonly availability: 'OPEN' | 'CLOSED';
    readonly reason: string;
  }
  const closures: ImportedClosure[] = runsBy<TelescopeKey>(
    rows,
    (row) => {
      if (row.telescope === 'Open') {
        return { availability: 'OPEN', reason: '' };
      }
      if (row.telescope === 'Closed') {
        return { availability: 'CLOSED', reason: modeOf(row.modeProgram) === null ? row.modeProgram : '' };
      }
      return null;
    },
    (a, b) => a.availability === b.availability && a.reason === b.reason,
  ).map((run) => ({
    site,
    port: null,
    availability: run.key.availability,
    ...spanFields(site, run.first, run.last),
    reason: run.key.reason === '' ? null : run.key.reason,
  }));

  const modes: ImportedTelescopeMode[] = runsBy(
    rows,
    (row) => (row.modeProgram === 'Shutdown' ? null : row.modeProgram),
    (a, b) => a === b,
  ).flatMap((run) => {
    const resolved = modeOf(run.key);
    if (resolved === null) {
      warnings.push(`${site} ${semester}: unrecognised Mode/Program "${run.key}" - not imported.`);
      return [];
    }
    const span = spanFields(site, run.first, run.last);
    return [
      {
        site,
        start: span.start,
        end: span.end,
        mode: resolved.mode,
        programReference: null,
        note: resolved.note,
      },
    ];
  });

  // The ToOs column is blank on every night of the current export, and the
  // observatory's default is standard ToO support - so a blank night is served
  // as STANDARD, carried as an assumption on the record rather than silently
  // (Dan, 2026-08-11). A written level is a recorded fact and supersedes the
  // assumption, splitting the run.
  interface TooKey {
    readonly value: string;
    readonly assumed: boolean;
  }
  const tooSupport: ImportedTooSupport[] = runsBy<TooKey>(
    rows,
    (row) => (row.toos === '' ? { value: 'Standard', assumed: true } : { value: row.toos, assumed: false }),
    (a, b) => a.value === b.value && a.assumed === b.assumed,
  ).flatMap((run) => {
    const level: TooSupportLevel | undefined = TOO[run.key.value as keyof typeof TOO];
    if (level === undefined) {
      warnings.push(`${site} ${semester}: unrecognised ToOs value "${run.key.value}" - not imported.`);
      return [];
    }
    const span = spanFields(site, run.first, run.last);
    return [
      {
        site,
        start: span.start,
        end: span.end,
        tooSupport: level,
        note: run.key.assumed ? 'Assumed: the workbook does not record ToO support' : null,
      },
    ];
  });

  // Usable-but-unmounted instruments: real records the schema has no row for
  // yet. Surfaced per run so the gap is a decision, not an accident.
  for (const column of Object.keys(rows[0]?.statuses ?? {})) {
    if (instrumentOf(column) === null) {
      continue; // Non-instrument columns are warned once, by the reader.
    }
    const offPort = runsBy(
      rows,
      (row) => {
        const status = row.statuses[column];
        const usable = status === 'Science' || status === 'Engineering';
        return usable && !row.ports.includes(column) ? status : null;
      },
      (a, b) => a === b,
    );
    for (const run of offPort) {
      warnings.push(
        `${site} ${semester}: ${column} is "${run.key}" with no port ${run.first}..${run.last} - off-port usability is not imported.`,
      );
    }
  }

  return {
    site,
    semester,
    title: `Gemini ${SITE_NAME[site]} Semester ${semester}`,
    version: WORKBOOK_VERSION,
    nightLabelling: 'EVENING',
    legend: [],
    rowLabels: [...ROW_LABELS],
    blocks,
    closures,
    tooSupport,
    modes,
    holidays: [],
    moonEvents: [],
    warnings,
  };
};

/** Every semester schedule the workbook holds, split by evening date. */
export const buildWorkbookSchedules = (sites: readonly SiteRows[]): readonly ImportedSchedule[] =>
  sites.flatMap(({ site, rows }) => {
    const ordered = [...rows].sort((a, b) => a.eveningDate.localeCompare(b.eveningDate));

    const bySemester = new Map<string, WorkbookRow[]>();
    for (const row of ordered) {
      const semester = semesterOfEvening(row.eveningDate);
      bySemester.set(semester, [...(bySemester.get(semester) ?? []), row]);
    }

    const semesters = [...bySemester.entries()];
    const last = semesters.at(-1);
    let trimNote: string | null = null;
    if (last?.[1].length === 1 && semesters.length > 1) {
      trimNote = `${site}: trimmed the single evening ${last[1][0]?.eveningDate ?? ''} of ${last[0]} - a one-night trailing semester is an export artifact.`;
      semesters.pop();
    }

    return semesters.map(([semester, semesterRows], index) =>
      buildSemester(
        site,
        semester,
        semesterRows,
        trimNote !== null && index === semesters.length - 1 ? [trimNote] : [],
      ),
    );
  });
