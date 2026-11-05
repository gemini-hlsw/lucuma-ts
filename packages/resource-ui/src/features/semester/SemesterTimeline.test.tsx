import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildSemesterTimeline } from '@/domain/semesterTimeline';
import { observingNightInterval } from '@/domain/siteTime';
import { domainInstrumentBlock, nightsSpan, scheduleOf } from '@/test/fixtures/domain';
import { renderWithRoute } from '@/test/render';

import { SemesterTimeline } from './SemesterTimeline';

/** Inside August, so the chart also carries the now marker. */
const NOW = observingNightInterval('GS', '2026-08-10').start;

const timeline = buildSemesterTimeline({
  site: 'GS',
  firstNight: '2026-08-02',
  lastNight: '2026-09-01',
  schedule: scheduleOf({
    instrumentAvailability: [
      domainInstrumentBlock({
        id: 'ghost',
        instrument: 'GHOST',
        interval: nightsSpan('GS', '2026-08-08', '2026-09-01'),
      }),
    ],
  }),
});

describe(SemesterTimeline, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('draws a region per month, named so it can be navigated', async () => {
    const screen = await renderWithRoute(<SemesterTimeline timeline={timeline} site="GS" />, {
      route: '/semester?site=GS',
    });

    await expect.element(screen.getByRole('region', { name: 'August 2026' })).toBeVisible();
  });
});
