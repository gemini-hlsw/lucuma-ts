/**
 * Seed data: the operations workbook's schedules, split by semester.
 *
 * Nothing here is hand-written. Every record was parsed out of
 * `fixtures/telescope_schedules.xlsx` - the operations team's own export and
 * the **only** source Resource populates from. The published web overview
 * sheets are no longer imported, and the synthetic GS 2099B demo semester is
 * gone with them: what the workbook holds is what the app shows.
 *
 * **These files are the source now.** Operations will not send another export,
 * so the reader that produced them was removed with its spreadsheet dependency
 * (2026-08-14) and lives on the `resource/workbook-importer` branch. Edit the
 * JSON, or revive that branch, if the data ever has to change.
 */
import gn2024B from './data/gn2024B.json' with { type: 'json' };
import gn2025A from './data/gn2025A.json' with { type: 'json' };
import gn2025B from './data/gn2025B.json' with { type: 'json' };
import gn2026A from './data/gn2026A.json' with { type: 'json' };
import gn2026B from './data/gn2026B.json' with { type: 'json' };
import gs2024B from './data/gs2024B.json' with { type: 'json' };
import gs2025A from './data/gs2025A.json' with { type: 'json' };
import gs2025B from './data/gs2025B.json' with { type: 'json' };
import gs2026A from './data/gs2026A.json' with { type: 'json' };
import type { ImportedSchedule } from './records.ts';

export interface MockState {
  readonly schedules: readonly ImportedSchedule[];
}

/**
 * JSON imports widen unions to `string`, so this data needs one cast to regain
 * its shape.
 *
 * The cast is **unchecked**, and it stopped being backed by anything on
 * 2026-08-14: the writer that guaranteed the shape - and whose tests caught a
 * drift before it reached here - left with the workbook importer. What still
 * catches a bad edit is `resolvers.test.ts`, which executes real queries
 * against the store these files seed, so a value the schema does not name
 * surfaces as a failing test rather than a wrong answer. Edit the JSON with
 * that in mind, and run the mock-server tests after.
 */
const imported = [
  gs2024B,
  gs2025A,
  gs2025B,
  gs2026A,
  gn2024B,
  gn2025A,
  gn2025B,
  gn2026A,
  gn2026B,
] as unknown as readonly [ImportedSchedule, ...ImportedSchedule[]];

export const buildSeedState = (): MockState => ({ schedules: [...imported] });
