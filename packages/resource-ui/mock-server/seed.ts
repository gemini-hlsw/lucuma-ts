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

/** Unchecked: nothing here writes these files, so `resolvers.test.ts` is what catches a bad edit. */
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
