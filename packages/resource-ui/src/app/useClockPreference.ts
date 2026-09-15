import { createPreference } from '@/app/preference';
import type { TimeDisplay } from '@/domain/siteTime';

const CLOCK_OPTIONS: readonly TimeDisplay[] = ['site', 'utc'];

export const [useClockPreference, setClockPreference] = createPreference<TimeDisplay>(
  'resource.clock',
  CLOCK_OPTIONS,
  'site',
);
