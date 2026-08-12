/**
 * Seed data: the operations workbook's schedules, split by semester.
 *
 * Nothing here is hand-written. Every record comes from
 * `mock-server/import/`, which parses `fixtures/telescope_schedules.xlsx` -
 * the operations team's own export and the **only** source Resource populates
 * from. The published web overview sheets are no longer imported, and the
 * synthetic GS 2099B demo semester is gone with them: what the workbook holds
 * is what the app shows.
 *
 * Re-generate with `pnpm import:schedule` after replacing the workbook
 * fixture with a newer export.
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
import type { ImportedSchedule } from './import/blocks.ts';

export interface MockState {
  readonly schedules: readonly ImportedSchedule[];
}

/**
 * JSON imports widen unions to `string`, so the generated data needs one cast to
 * regain its shape. It is safe because the same module that defines
 * `ImportedSchedule` writes these files - a shape change fails the importer's
 * tests before it can reach here.
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
