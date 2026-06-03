/**
 * Adapts GraphQL timeline data into generic timeline rows.
 */
import type { TelescopeNightTimeline, TimelineRowData, TimelineVariant } from './types';
import type { TelescopeAvailability, TelescopeModeType, TooSupport } from '../../gql/gen/graphql';

const modeVariants = {
  QUEUE: 'queue',
  CLASSICAL: 'classical',
  COMMISSIONING: 'commissioning',
  ENGINEERING: 'engineering',
  PRIORITY_VISITOR: 'priorityVisitor',
} satisfies Record<TelescopeModeType, TimelineVariant>;

const availabilityVariants = {
  OPEN: 'open',
  CLOSED: 'closed',
} satisfies Record<TelescopeAvailability, TimelineVariant>;

/**
 * Adapts telescope night GraphQL data into timeline rows used by the chart.
 *
 * The resulting rows represent observing mode, telescope availability,
 * and ToO support over the course of the observing night.
 */
export const toTimelineRows = (timeline: TelescopeNightTimeline): TimelineRowData[] => [
  toModeRow(timeline),
  toAvailabilityRow(timeline),
  toTooRow(timeline),
];

const getVariantFromMode = (mode: TelescopeModeType | null | undefined): TimelineVariant =>
  mode === null || mode === undefined ? 'unknown' : modeVariants[mode];

const getVariantFromAvailability = (availability: TelescopeAvailability | null | undefined): TimelineVariant =>
  availability === null || availability === undefined ? 'unknown' : availabilityVariants[availability];

const getVariantFromTooSupport = (tooSupport: TooSupport | null | undefined): TimelineVariant => {
  if (tooSupport === null || tooSupport === undefined || tooSupport === 'NONE') {
    return 'unknown';
  }

  return 'too';
};

/**
 * Builds the observing-mode timeline row.
 */
const toModeRow = (timeline: TelescopeNightTimeline): TimelineRowData => ({
  id: 'mode',
  label: 'MODE',
  blocks: timeline.modes.map((item, index) => ({
    id: `mode-${index}-${item.interval.start}`,
    interval: item.interval,
    label: item.mode.type,
    variant: getVariantFromMode(item.mode.type),
  })),
});

/**
 * Builds the telescope-availability timeline row.
 */
const toAvailabilityRow = (timeline: TelescopeNightTimeline): TimelineRowData => ({
  id: 'availability',
  label: 'TELESCOPE',
  blocks: timeline.availability.map((item, index) => ({
    id: `availability-${index}-${item.interval.start}`,
    interval: item.interval,
    label: item.availability,
    variant: getVariantFromAvailability(item.availability),
  })),
});

/**
 * Builds the ToO-support timeline row.
 */
const toTooRow = (timeline: TelescopeNightTimeline): TimelineRowData => ({
  id: 'too',
  label: 'ToO',
  blocks: timeline.tooStatus.map((item, index) => ({
    id: `too-${index}-${item.interval.start}`,
    interval: item.interval,
    label: item.tooSupport ?? 'NONE',
    variant: getVariantFromTooSupport(item.tooSupport),
  })),
});
