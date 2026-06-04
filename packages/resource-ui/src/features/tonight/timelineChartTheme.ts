/**
 * Shared Highcharts layout and CSS variable tokens for the Tonight timeline.
 */
import type { TimelineVariant } from './types';

export const timelineChartTheme = {
  layout: {
    topAxisHeight: 48,
    bottomAxisHeight: 64,
    rowHeight: 66,
    pointWidth: 42,
    marginLeft: 116,
    marginRight: 25,
    spacing: [0, 0, 0, 0] as number[],
  },

  axis: {
    offset: 8,
    tickLength: 8,
    tickWidth: 1,
    gridLineWidth: 1,
    hourTickInterval: 60 * 60 * 1000,
    topLabelY: -12,
    bottomLabelY: 24,
    labelRotation: -45,
    labelFontSize: '11px',
    rowLabelFontSize: '13px',
    yMinPadding: -0.5,
    yMaxPadding: 0.5,
  },

  now: {
    labelY: 12,
    lineWidth: 2,
    lineZIndex: 5,
  },

  block: {
    borderRadius: 6,
    labelFontSize: '12px',
    timeLabelFontSize: '10px',
    timeLabelOpacity: 0.9,
    hoverBrightness: 0.08,
  },

  tooltip: {
    borderRadius: 8,
  },

  font: {
    family: 'inherit',
    weightBold: '700',
  },

  color: {
    background: 'transparent',
    text: 'var(--timeline-text)',
    mutedText: 'var(--timeline-muted-text)',
    grid: 'var(--timeline-grid)',
    axis: 'var(--timeline-axis)',
    blockBorder: 'var(--timeline-block-border)',
    tooltipBackground: 'rgb(24 24 27)',
    tooltipBorder: 'rgb(63 63 70)',
    now: 'var(--timeline-now)',

    variants: {
      queue: 'var(--timeline-queue)',
      classical: 'var(--timeline-classical)',
      commissioning: 'var(--timeline-commissioning)',
      engineering: 'var(--timeline-engineering)',
      priorityVisitor: 'var(--timeline-priority-visitor)',
      open: 'var(--timeline-open)',
      closed: 'var(--timeline-closed)',
      too: 'var(--timeline-too)',
      unknown: 'var(--timeline-unknown)',
    } satisfies Record<TimelineVariant, string>,
  },
} as const;
