import { describe, expect, it, vi } from 'vitest';

import { timelineFactory } from '@/test/factories';
import { getTimestamp } from './time';
import { createTimelineChartConfig } from './timelineChartConfig';
import type { TimelineBlock } from './types';

const displayInterval = timelineFactory.interval('2026-08-01T19:00:00-10:00', '2026-08-02T08:00:00-10:00');

const modeBlock = timelineFactory.block();

const rows = [
  timelineFactory.row({ blocks: [modeBlock] }),
  timelineFactory.row({
    id: 'availability',
    label: 'TELESCOPE',
    blocks: [],
  }),
];

const createConfig = (
  overrides: {
    readonly displayInterval?: typeof displayInterval;
    readonly onBlockSelect?: (block: TimelineBlock) => void;
  } = {},
) =>
  createTimelineChartConfig({
    site: 'GN',
    timeDisplay: 'site',
    displayInterval: overrides.displayInterval ?? displayInterval,
    rows,
    onBlockSelect: overrides.onBlockSelect ?? vi.fn(),
  });

describe(createTimelineChartConfig.name, () => {
  it('maps timeline blocks to xrange points', () => {
    const config = createConfig();

    expect(config.points).toMatchObject([
      {
        x: getTimestamp(modeBlock.interval.start),
        x2: getTimestamp(modeBlock.interval.end),
        y: 0,
        name: 'QUEUE',
        custom: {
          block: modeBlock,
          rowLabel: 'MODE',
        },
      },
    ]);
  });

  it('sets the display interval on the time axis', () => {
    const config = createConfig();

    expect(config.bottomAxisProps.min).toBe(getTimestamp(displayInterval.start));
    expect(config.bottomAxisProps.max).toBe(getTimestamp(displayInterval.end));
  });

  it('always shows the now plot line', () => {
    const config = createConfig();

    expect(config.bottomAxisProps.plotLines).toHaveLength(1);
  });

  it('sets row labels on the y axis', () => {
    const config = createConfig();

    expect(config.yAxisProps.categories).toEqual(['MODE', 'TELESCOPE']);
  });
});
