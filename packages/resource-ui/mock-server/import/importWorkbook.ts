/**
 * Reads the operations workbook and writes the per-semester JSON the mock
 * seeds from. The only part of the import that touches disk; the parsing is
 * `workbook.ts`, which is pure and unit-tested.
 *
 *   pnpm --filter @gemini-hlsw/resource-ui import:schedule
 *
 * A new export from operations means replacing
 * `fixtures/telescope_schedules.xlsx` and re-running this. Nothing is fetched
 * from the web: the published overview sheets this replaced are no longer a
 * source.
 */
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The default import, deliberately: exceljs ships a CJS bundle whose named
// exports node's ESM loader cannot detect, so `import { Workbook }` parses but
// crashes at runtime under plain node.
import ExcelJS from 'exceljs';

type CellValue = ExcelJS.CellValue;
type Worksheet = ExcelJS.Worksheet;

import type { ImportSite } from './blocks.ts';
import { instrumentOf } from './instruments.ts';
import { buildWorkbookSchedules, type SiteRows, type WorkbookRow } from './workbook.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const WORKBOOK_PATH = path.join(here, '..', 'fixtures', 'telescope_schedules.xlsx');
const DATA_DIR = path.join(here, '..', 'data');

const FIXED_COLUMNS = ['Local Date', 'Telescope', 'Mode/Program', 'LGS', 'ToOs'];
const PORT_COLUMNS = ['Port 1', 'Port 2', 'Port 3', 'Port 4', 'Port 5'];

/** A cell as text, trimmed; empty and "None" cells are null. */
const textOf = (value: CellValue): string | null => {
  // Only scalar cells are text; a rich-text or formula cell is not schedule data.
  const text = (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '').trim();
  return text === '' || text === 'None' ? null : text;
};

/**
 * The ToOs cell verbatim, trimmed. Unlike the port cells, "None" here would be
 * a recorded fact (no ToOs of any kind), so it must survive - and an empty
 * cell stays empty: the column is blank on every night of the current export,
 * and blank means "not recorded", never a value (I4). An earlier version
 * defaulted the blank to "None" and invented a semester of ToO records.
 */
const tooTextOf = (value: CellValue): string =>
  (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '').trim();

/** The sheet's Local Date cell as an ISO date. ExcelJS parses dates as UTC. */
const dateOf = (value: CellValue): string | null => (value instanceof Date ? value.toISOString().slice(0, 10) : null);

const readSheet = (sheet: Worksheet, site: ImportSite, notes: string[]): SiteRows => {
  const headerRow = sheet.getRow(1);
  const headers = new Map<string, number>();
  headerRow.eachCell((cell, column) => {
    const header = textOf(cell.value);
    if (header !== null) {
      headers.set(header, column);
    }
  });

  for (const required of [...FIXED_COLUMNS, ...PORT_COLUMNS]) {
    if (!headers.has(required)) {
      throw new Error(`${site}: workbook sheet is missing the "${required}" column.`);
    }
  }

  const statusColumns = [...headers.keys()].filter(
    (header) => !FIXED_COLUMNS.includes(header) && !PORT_COLUMNS.includes(header),
  );
  const ignored = statusColumns.filter((header) => instrumentOf(header) === null);
  if (ignored.length > 0) {
    notes.push(`${site}: columns with no schema home, not imported: ${ignored.join(', ')}.`);
  }

  const rows: WorkbookRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }
    const cellOf = (header: string): CellValue => row.getCell(headers.get(header) ?? 0).value;
    const eveningDate = dateOf(cellOf('Local Date'));
    if (eveningDate === null) {
      return;
    }
    rows.push({
      eveningDate,
      telescope: textOf(cellOf('Telescope')) ?? '',
      modeProgram: textOf(cellOf('Mode/Program')) ?? '',
      lgs: textOf(cellOf('LGS')) ?? '',
      toos: tooTextOf(cellOf('ToOs')),
      ports: PORT_COLUMNS.map((header) => textOf(cellOf(header))),
      statuses: Object.fromEntries(
        statusColumns.flatMap((header) => {
          const value = textOf(cellOf(header));
          return value === null ? [] : [[header, value]];
        }),
      ),
    });
  });

  const lgs = new Set(rows.map((row) => row.lgs));
  notes.push(`${site}: LGS column (${[...lgs].join('/')}) has no schema home, not imported.`);

  return { site, rows };
};

const main = async (): Promise<void> => {
  // eslint-disable-next-line import-x/no-named-as-default-member
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(process.argv[2] ?? WORKBOOK_PATH);

  const notes: string[] = [];
  const sites: SiteRows[] = [];
  for (const site of ['GS', 'GN'] as const) {
    const sheet = workbook.getWorksheet(site);
    if (sheet === undefined) {
      throw new Error(`The workbook has no "${site}" sheet.`);
    }
    sites.push(readSheet(sheet, site, notes));
  }

  const schedules = buildWorkbookSchedules(sites);

  await mkdir(DATA_DIR, { recursive: true });
  for (const stale of await readdir(DATA_DIR)) {
    if (stale.endsWith('.json')) {
      await unlink(path.join(DATA_DIR, stale));
    }
  }

  for (const schedule of schedules) {
    const file = path.join(DATA_DIR, `${schedule.site.toLowerCase()}${schedule.semester}.json`);
    await writeFile(file, `${JSON.stringify(schedule, null, 2)}\n`);
    console.log(
      `${schedule.site} ${schedule.semester}: ${String(schedule.blocks.length)} blocks, ` +
        `${String(schedule.closures.length)} closures, ${String(schedule.modes?.length ?? 0)} modes, ` +
        `${String(schedule.tooSupport?.length ?? 0)} ToO -> ${path.basename(file)}`,
    );
    for (const warning of schedule.warnings) {
      console.warn(`  warning: ${warning}`);
    }
  }
  for (const note of notes) {
    console.warn(`note: ${note}`);
  }
};

await main();
