import { describe, expect, it } from 'vitest';

import { buildSemesterTimeline } from '@/domain/semesterTimeline';
import type { Schedule } from '@/domain/types';
import { domainInstrumentBlock, domainTelescopeClosure, nightsSpan, scheduleOf } from '@/test/fixtures/domain';
import { renderWithContext } from '@/test/render';

import { SemesterBlockTable } from './SemesterBlockTable';

const SITE = 'GS' as const;

const GMOS_WEEK = domainInstrumentBlock({
  id: 'm1',
  port: 3,
  interval: nightsSpan(SITE, '2026-08-08', '2026-08-14'),
});

const SHUTDOWN = domainTelescopeClosure({
  id: 'wide',
  interval: nightsSpan(SITE, '2026-08-08', '2026-08-10'),
  reason: 'Telescope Shutdown A&G Maintenance',
});

const renderTable = (schedule: Partial<Schedule>) =>
  renderWithContext(
    <SemesterBlockTable
      site={SITE}
      caption="Blocks of 2026B"
      timeline={buildSemesterTimeline({
        site: SITE,
        firstNight: '2026-08-08',
        lastNight: '2026-08-14',
        schedule: scheduleOf(schedule),
      })}
    />,
  );

describe(SemesterBlockTable, () => {
  it('should head the table with its caption and the five columns when it renders', async () => {
    const screen = await renderTable({ instrumentAvailability: [GMOS_WEEK] });

    const table = screen.getByRole('table', { name: 'Blocks of 2026B' });
    await expect.element(table).toBeInTheDocument();
    expect(
      table
        .getByRole('columnheader')
        .elements()
        .map((header) => header.textContent),
    ).toEqual(['Row', 'Subject', 'First night', 'Last night', 'Length']);
  });

  it('should state a run as one row headed by its port when a block spans several nights', async () => {
    const screen = await renderTable({ instrumentAvailability: [GMOS_WEEK] });

    const row = screen.getByRole('row', { name: 'Port 3 GMOS 7 Aug 2026 13 Aug 2026 7 nights' });
    await expect.element(row).toBeInTheDocument();
    await expect.element(row.getByRole('rowheader')).toHaveTextContent('Port 3');
    expect(screen.getByRole('rowheader').elements()).toHaveLength(1);
  });

  it('should file a telescope-wide closure under Whole telescope when the schedule has a closure band', async () => {
    const screen = await renderTable({ telescopeAvailability: [SHUTDOWN] });

    await expect
      .element(screen.getByRole('row', { name: /^Whole telescope Telescope Shutdown A&G Maintenance/ }))
      .toBeInTheDocument();
  });
});
