import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';

import type { TimelineLegend } from '@/domain/timeline';

import { TimelineLegendBar } from './TimelineChart';

const interval = { start: 1_000, end: 2_000 };
const EMPTY: TimelineLegend = {
  instruments: [],
  modes: [],
  toos: [],
  hasOpen: false,
  hasClosure: false,
  hasUnscheduled: false,
  hasEngineeringUse: false,
  hasUnavailable: false,
  hasWeekend: false,
  hasNoData: false,
};

describe(TimelineLegendBar, () => {
  it('draws no section for an empty legend', async () => {
    const screen = await render(<TimelineLegendBar legend={EMPTY} span={interval} now={interval.end} />);

    await expect.element(screen.getByLabelText('Legend')).toBeInTheDocument();
    await expect.element(screen.getByRole('group')).not.toBeInTheDocument();
  });

  const SECTIONS: readonly { section: string; keys: Partial<TimelineLegend>; labels: readonly string[] }[] = [
    { section: 'Telescope', keys: { hasOpen: true, hasClosure: true }, labels: ['Open', 'Closed'] },
    { section: 'Mode', keys: { modes: ['QUEUE', 'SHUTDOWN'] }, labels: ['Queue', 'Shutdown'] },
    { section: 'ToO', keys: { toos: ['RAPID', 'NONE'] }, labels: ['Rapid', 'None'] },
    {
      section: 'Instruments',
      keys: { instruments: ['GMOS'], hasEngineeringUse: true, hasUnavailable: true, hasUnscheduled: true },
      labels: ['GMOS', 'Engineering use', 'Not available', 'No instrument scheduled'],
    },
    { section: 'Calendar', keys: { hasWeekend: true, hasNoData: true }, labels: ['Weekend', 'Nothing recorded'] },
  ];

  it.each(SECTIONS)('keys $labels under $section, and draws no other section', async ({ section, keys, labels }) => {
    const screen = await render(
      <TimelineLegendBar legend={{ ...EMPTY, ...keys }} span={interval} now={interval.end} />,
    );
    const group = screen.getByRole('group', { name: section });

    for (const label of labels) {
      await expect.element(group.getByText(label)).toBeVisible();
    }
    expect(screen.getByRole('group').elements()).toHaveLength(1);
  });

  it.each([
    { nowLabel: undefined, label: 'Now' },
    { nowLabel: 'Today', label: 'Today' },
  ] as const)('keys the clock inside the window as $label', async ({ nowLabel, label }) => {
    const screen = await render(
      <TimelineLegendBar legend={EMPTY} span={interval} now={interval.start} nowLabel={nowLabel} />,
    );

    await expect.element(screen.getByRole('group', { name: 'Calendar' }).getByText(label)).toBeVisible();
  });

  it('keys no clock once it leaves the window', async () => {
    const screen = await render(<TimelineLegendBar legend={EMPTY} span={interval} now={interval.end} />);

    await expect.element(screen.getByRole('group', { name: 'Calendar' })).not.toBeInTheDocument();
  });
});
